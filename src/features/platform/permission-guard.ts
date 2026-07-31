import type { StaffMember } from "@/lib/types";
import { getDb, getRawPrisma, type ScopedDb } from "@/features/shared/db";
import { getCurrentStaff } from "@/features/workforce/staff-core";
import { getRolePermissions } from "@/features/platform/permission-core";
import {
  canDo,
  ACTION_META,
  type StaffAction,
  type RolePermissions,
  type ActorContext,
  type ResourceContext,
} from "@/features/shared/permissions";
import {
  requireApiArea,
  sessionToDbContext,
  type AuthSession,
} from "@/features/platform/auth-helpers";

/**
 * Server-side authorization guard. Collapses the copy-pasted preamble
 * (requireApiArea → sessionToDbContext → getDb → getCurrentStaff →
 * getRolePermissions → canDo) into one call, and hands the handler everything
 * it needs so it never re-fetches. Route handlers import this dynamically inside
 * their live branch, keeping server-only deps out of the demo bundle.
 *
 * Returns the same { status, error } discriminated shape as requireApiArea — no
 * throwing, no redirect() (a redirect inside a fetch handler yields HTML, not
 * JSON).
 */
export type StaffContext = {
  session: AuthSession;
  venueId: string;
  db: ScopedDb;
  staff: StaffMember;
  permissions: RolePermissions;
  /** The actor built from the resolved staff row, for canDo resource checks. */
  actor: ActorContext;
};

export type GuardResult = StaffContext | { status: number; error: string };

export function isDenied(
  result: GuardResult,
): result is { status: number; error: string } {
  return "error" in result;
}

/**
 * Resolves the full staff context after the area gate, without checking a
 * specific action. Use for handlers whose decision needs the resource row first
 * (ownership/zone-scoped actions): call canDo(permissions, staff.role, action,
 * { actor, resource }) yourself once you've loaded the row.
 *
 * One call performs exactly two reads (the staff row + the permission overrides)
 * — the same the copy-pasted preamble did, now in one place. A handler that
 * guards once (the common case) pays for them once.
 */
export async function requireStaffContext(
  area: "manager" | "staff",
): Promise<GuardResult> {
  const auth = await requireApiArea(area);
  if ("error" in auth) return auth;

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const staff = await getCurrentStaff(getRawPrisma(), venueId, auth.session.user.id);
  if (!staff) return { status: 403, error: "Staff profile not found" };

  const permissions = await getRolePermissions(db);
  return {
    session: auth.session,
    venueId,
    db,
    staff,
    permissions,
    actor: { staffId: staff.id, assignedZoneIds: staff.assignedZoneIds },
  };
}

/**
 * The common case: gate a handler on a single StaffAction. Optionally pass a
 * `resource` to enforce an ownership/zone-scoped predicate in the same call.
 */
export async function requirePermission(
  area: "manager" | "staff",
  action: StaffAction,
  resource?: ResourceContext,
): Promise<GuardResult> {
  const ctx = await requireStaffContext(area);
  if ("error" in ctx) return ctx;

  if (!canDo(ctx.permissions, ctx.staff.role, action, { actor: ctx.actor, resource })) {
    return {
      status: 403,
      error: `Role ${ctx.staff.role} cannot ${ACTION_META[action].label.toLowerCase()}`,
    };
  }
  return ctx;
}
