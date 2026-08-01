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
  const { claimOrder } = await import("@/features/ordering/core");

  const auth = await requirePermission("staff", "order:claim");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId, db, staff } = auth;
  const { id } = await params;

  const result = await claimOrder(db, venueId, id, staff.id, staff.name);

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json(result.order);
}

export const PATCH = isDemoMode() ? demoHandler : livePATCH;
