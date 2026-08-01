import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Purchasing routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { listPurchaseOrders } = await import("@/features/platform/purchasing-core");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const supplierId = request.nextUrl.searchParams.get("supplierId") ?? undefined;
  const orders = await listPurchaseOrders(db, supplierId);
  return NextResponse.json(orders);
}

async function livePOST(request: NextRequest) {
  const { requirePermission } = await import("@/features/platform/permission-guard");
  const { savePurchaseOrder } = await import("@/features/platform/purchasing-core");
  const { zPurchaseOrder } = await import("@/features/platform/purchasing-schemas");

  const auth = await requirePermission("staff", "purchasing:draft");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zPurchaseOrder.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { venueId, db } = auth;
  const order = await savePurchaseOrder(db, { ...parsed.data, venueId });
  return NextResponse.json(order, { status: 201 });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
