import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";
import { publish } from "@/features/realtime/events";

function demoHandler() {
  return NextResponse.json({ error: "Purchasing routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { receivePurchaseOrder, detectPriceChanges } = await import("@/features/platform/purchasing-core");
  const { zReceiveLines } = await import("@/features/platform/purchasing-schemas");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zReceiveLines.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { id } = await params;
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  // Detect price changes before receiving
  const po = await db.purchaseOrder.findUnique({ where: { id } });
  if (!po) return NextResponse.json({ error: "PO not found" }, { status: 404 });

  const poSupplierId = po.supplierId;
  const poLines = (po.lines as Array<Record<string, unknown>>) ?? [];
  const receiptMap = new Map(parsed.data.lines.map((l) => [l.lineId, l.qtyReceived]));
  const changedLines = poLines
    .filter((l) => receiptMap.has(l.id as string) && (receiptMap.get(l.id as string) ?? 0) > 0)
    .map((l) => ({
      menuItemId: l.menuItemId as string,
      unitCostCents: l.unitCostCents as number,
    }));

  const priceChanges = await detectPriceChanges(db, poSupplierId, changedLines);
  if (priceChanges.length > 0 && !parsed.data.acknowledgePriceChanges) {
    return NextResponse.json({ error: "Price changes detected", priceChanges }, { status: 409 });
  }

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
