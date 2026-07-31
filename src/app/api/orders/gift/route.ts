import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Order routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb, getRawPrisma } = await import("@/features/shared/db");
  const { sendGift } = await import("@/features/ordering/core");
  const { zSendGift } = await import("@/features/ordering/schemas");
  const { getCurrentStaff } = await import("@/features/workforce/staff-core");
  const { getRolePermissions } = await import("@/features/platform/permission-core");
  const { canDo } = await import("@/features/shared/permissions");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zSendGift.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const staff = await getCurrentStaff(getRawPrisma(), venueId, auth.session.user.id);
  if (!staff) return NextResponse.json({ error: "Staff profile not found" }, { status: 403 });
  const permissions = await getRolePermissions(db);
  if (!canDo(permissions, staff.role, "order:gift")) {
    return NextResponse.json({ error: `Role ${staff.role} cannot gift orders` }, { status: 403 });
  }

  const result = await sendGift(db, venueId, parsed.data);

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json(result.order, { status: 201 });
}

export const POST = isDemoMode() ? demoHandler : livePOST;
