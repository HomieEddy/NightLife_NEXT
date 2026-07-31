import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";
import type { RolePermissions } from "@/features/shared/permissions";

function demoHandler() {
  return NextResponse.json(
    { error: "Permission routes are disabled in demo mode" },
    { status: 404 },
  );
}

async function liveGET(_request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { getRolePermissions } = await import("@/features/platform/permission-core");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const permissions = await getRolePermissions(getDb({ venueId }));
  return NextResponse.json(permissions);
}

async function livePUT(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { setRolePermissions } = await import("@/features/platform/permission-core");
  const { zRolePermissions } = await import("@/features/platform/permission-schemas");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const parsed = zRolePermissions.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const { previous, next } = await setRolePermissions(db, parsed.data as RolePermissions);

  // Write audit entry for the change.
  const changedRoles = Object.keys(next).filter(
    (r) => JSON.stringify(previous[r as keyof typeof previous]) !== JSON.stringify(next[r as keyof typeof next]),
  );
  await db.auditEntry.create({
    data: {
      venueId,
      actorStaffId: auth.session.user.id,
      actorName: auth.session.user.name,
      action: "permissions:update",
      targetType: "role-permissions",
      targetId: venueId,
      summary: `Updated permissions for: ${changedRoles.join(", ") || "(none)"}`,
      metadata: { roles: changedRoles },
    },
  });

  return NextResponse.json(next);
}

async function liveDELETE(_request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { resetRolePermissions } = await import("@/features/platform/permission-core");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const { next } = await resetRolePermissions(db);

  await db.auditEntry.create({
    data: {
      venueId,
      actorStaffId: auth.session.user.id,
      actorName: auth.session.user.name,
      action: "permissions:reset",
      targetType: "role-permissions",
      targetId: venueId,
      summary: "Reset all role permissions to app defaults",
    },
  });

  return NextResponse.json(next);
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const PUT = isDemoMode() ? demoHandler : livePUT;
export const DELETE = isDemoMode() ? demoHandler : liveDELETE;
