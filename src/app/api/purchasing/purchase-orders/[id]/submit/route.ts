import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";
import { publish } from "@/features/realtime/events";

function demoHandler() {
  return NextResponse.json({ error: "Purchasing routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requirePermission } = await import("@/features/platform/permission-guard");
  const { submitPurchaseOrder } = await import("@/features/platform/purchasing-core");

  const auth = await requirePermission("staff", "purchasing:submit");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const { venueId, db } = auth;
  const staffId = auth.session.user.id;
  const order = await submitPurchaseOrder(db, id, staffId);

  publish({
    type: "PurchaseOrderSubmitted",
    venueId,
    payload: { purchaseOrderId: id, code: order.code, supplierId: order.supplierId, submittedByStaffId: staffId },
  }).catch(() => {});

  return NextResponse.json(order);
}

export const POST = isDemoMode() ? demoHandler : livePOST;
