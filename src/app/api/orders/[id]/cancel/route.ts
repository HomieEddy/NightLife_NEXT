import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Order routes are disabled in demo mode" }, { status: 404 });
}

async function livePATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { requirePermission } = await import("@/features/platform/permission-guard");
  const { cancelOrder } = await import("@/features/ordering/core");

  // order:cancel reverses inventory + revenue, so runner/security/promoter
  // tokens must not be able to cancel someone's order.
  const auth = await requirePermission("staff", "order:cancel");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId, db } = auth;
  const { id } = await params;
  const order = await cancelOrder(db, id);

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(order);
}

export const PATCH = isDemoMode() ? demoHandler : livePATCH;
