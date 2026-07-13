import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Order routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/server/auth-helpers");
  const { getDb } = await import("@/server/db");
  const { listOrders } = await import("@/server/order-core");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const url = new URL(request.url);
  const status = url.searchParams.getAll("status");
  const zoneIds = url.searchParams.getAll("zoneId");
  const sessionId = url.searchParams.get("sessionId") ?? undefined;
  const guestName = url.searchParams.get("guestName") ?? undefined;

  const filter = {
    ...(status.length ? { status: status as ("pending" | "accepted" | "preparing" | "ready" | "delivered" | "cancelled")[] } : {}),
    ...(zoneIds.length ? { zoneIds } : {}),
    ...(sessionId ? { sessionId } : {}),
    ...(guestName ? { guestName } : {}),
  };

  return NextResponse.json(await listOrders(db, filter));
}

async function livePOST(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/server/auth-helpers");
  const { getDb } = await import("@/server/db");
  const { submitOrder } = await import("@/server/order-core");
  const { zSubmitOrder } = await import("@/server/schemas/orders");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zSubmitOrder.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const result = await submitOrder(db, venueId, parsed.data);

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json(result.order, { status: 201 });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
