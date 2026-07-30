import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Order routes are disabled in demo mode" }, { status: 404 });
}

async function livePATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { remakeOrder } = await import("@/features/tab/core");
  const { zRemakeOrder } = await import("@/features/tab/schemas");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zRemakeOrder.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { id } = await params;
  const { venueId } = sessionToDbContext(auth.session);
  const link = await remakeOrder(
    getDb({ venueId }), venueId, id,
    parsed.data.newOrderId, parsed.data.reason,
    parsed.data.staffId, parsed.data.staffName,
  );
  if (!link) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  return NextResponse.json(link, { status: 201 });
}

export const PATCH = isDemoMode() ? demoHandler : livePATCH;
