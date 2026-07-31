import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Order routes are disabled in demo mode" }, { status: 404 });
}

async function livePATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb, getRawPrisma } = await import("@/features/shared/db");
  const { claimOrder } = await import("@/features/ordering/core");
  const { getCurrentStaff } = await import("@/features/workforce/staff-core");
  const { getRolePermissions } = await import("@/features/platform/permission-core");
  const { canDo } = await import("@/features/shared/permissions");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const { id } = await params;
  const staff = await getCurrentStaff(getRawPrisma(), venueId, auth.session.user.id);
  if (!staff) return NextResponse.json({ error: "Staff profile not found" }, { status: 403 });

  const permissions = await getRolePermissions(db);
  if (!canDo(permissions, staff.role, "order:claim")) {
    return NextResponse.json({ error: `Role ${staff.role} cannot claim orders` }, { status: 403 });
  }

  const result = await claimOrder(db, venueId, id, staff.id, staff.name);

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json(result.order);
}

export const PATCH = isDemoMode() ? demoHandler : livePATCH;
