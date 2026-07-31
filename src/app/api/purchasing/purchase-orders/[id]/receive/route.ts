import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";
import { publish } from "@/features/realtime/events";

function demoHandler() {
  return NextResponse.json({ error: "Purchasing routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { receivePurchaseOrder } = await import("@/features/platform/purchasing-core");
  const { zReceiveLines } = await import("@/features/platform/purchasing-schemas");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zReceiveLines.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { id } = await params;
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const order = await receivePurchaseOrder(db, id, parsed.data.lines);

  const totalReceived = parsed.data.lines.reduce((sum, l) => sum + l.qtyReceived, 0);
  publish({
    type: "StockReceived",
    venueId,
    payload: { purchaseOrderId: id, code: order.code, totalReceived, status: order.status },
  }).catch(() => {});

  return NextResponse.json(order);
}

export const POST = isDemoMode() ? demoHandler : livePOST;
