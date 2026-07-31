import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";
import { z } from "zod";

function demoHandler() {
  return NextResponse.json({ error: "Session routes are disabled in demo mode" }, { status: 404 });
}

const zAssign = z.object({
  hostStaffId: z.string().min(1),
  hostStaffName: z.string().min(1),
});

async function livePOST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb, getRawPrisma } = await import("@/features/shared/db");
  const { getCurrentStaff } = await import("@/features/workforce/staff-core");
  const { getRolePermissions } = await import("@/features/platform/permission-core");
  const { canDo } = await import("@/features/shared/permissions");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zAssign.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { id } = await params;
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const staff = await getCurrentStaff(getRawPrisma(), venueId, auth.session.user.id);
  if (!staff) return NextResponse.json({ error: "Staff profile not found" }, { status: 403 });
  const permissions = await getRolePermissions(db);
  if (!canDo(permissions, staff.role, "session:approve")) {
    return NextResponse.json({ error: `Role ${staff.role} cannot approve sessions` }, { status: 403 });
  }

  const session = await db.guestSession.findFirst({ where: { id, venueId } });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const updated = await db.guestSession.update({
    where: { id },
    data: { hostStaffId: parsed.data.hostStaffId, hostStaffName: parsed.data.hostStaffName },
  });
  return NextResponse.json(updated);
}

async function liveDELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb, getRawPrisma } = await import("@/features/shared/db");
  const { getCurrentStaff } = await import("@/features/workforce/staff-core");
  const { getRolePermissions } = await import("@/features/platform/permission-core");
  const { canDo } = await import("@/features/shared/permissions");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const staff = await getCurrentStaff(getRawPrisma(), venueId, auth.session.user.id);
  if (!staff) return NextResponse.json({ error: "Staff profile not found" }, { status: 403 });
  const permissions = await getRolePermissions(db);
  if (!canDo(permissions, staff.role, "session:deny")) {
    return NextResponse.json({ error: `Role ${staff.role} cannot deny sessions` }, { status: 403 });
  }

  const session = await db.guestSession.findFirst({ where: { id, venueId } });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const updated = await db.guestSession.update({
    where: { id },
    data: { hostStaffId: null, hostStaffName: null },
  });
  return NextResponse.json(updated);
}

export const POST = isDemoMode() ? demoHandler : livePOST;
export const DELETE = isDemoMode() ? demoHandler : liveDELETE;
