import type { PrismaClient } from "@prisma/client";
import { DEFAULT_ROLE_PERMISSIONS } from "@/features/shared/permissions";
import type { RolePermissions, StaffAction } from "@/features/shared/permissions";
import type { StaffRole } from "@/lib/types";

// ---------- Pure helpers (unit-testable without a DB) ----------

/**
 * Merges stored overrides into the default permission matrix.
 * Each row replaces that role's actions entirely.
 */
export function mergePermissions(
  rows: { role: StaffRole; actions: string[] }[],
): RolePermissions {
  const merged = structuredClone(DEFAULT_ROLE_PERMISSIONS);
  for (const row of rows) {
    merged[row.role] = row.actions as StaffAction[];
  }
  return merged;
}

/** Returns the roles whose stored actions differ from defaults. */
export function computeDeltas(
  permissions: RolePermissions,
): { role: StaffRole; actions: StaffAction[] }[] {
  const deltas: { role: StaffRole; actions: StaffAction[] }[] = [];
  for (const [role, actions] of Object.entries(permissions) as [StaffRole, StaffAction[]][]) {
    const defaults = DEFAULT_ROLE_PERMISSIONS[role];
    if (!arraysEqual(actions, defaults)) {
      deltas.push({ role, actions });
    }
  }
  return deltas;
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}

// ---------- DB operations ----------

/**
 * Reads all venue_role_permissions rows and merges them over
 * DEFAULT_ROLE_PERMISSIONS. The db extension scopes to the caller's venueId.
 */
export async function getRolePermissions(
  db: PrismaClient,
): Promise<RolePermissions> {
  const rows = await db.venueRolePermissions.findMany({
    select: { role: true, actions: true },
  });
  return mergePermissions(rows);
}

/**
 * Replaces the stored permission overrides atomically.
 * Only rows that differ from defaults are persisted (deltas).
 * Returns the before/after state so callers can write an audit entry.
 */
export async function setRolePermissions(
  db: PrismaClient,
  permissions: RolePermissions,
): Promise<{ previous: RolePermissions; next: RolePermissions }> {
  const previous = await getRolePermissions(db);
  const deltas = computeDeltas(permissions);

  await db.$transaction(async (tx) => {
    // Clear all existing overrides for this venue (extension adds venueId).
    await tx.venueRolePermissions.deleteMany();
    // Insert fresh deltas (extension adds venueId to createMany data).
    if (deltas.length > 0) {
      // The db extension injects venueId into every createMany data item
      // automatically (see db.ts tenant-scoping middleware).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await tx.venueRolePermissions.createMany({
        data: deltas.map((d) => ({ role: d.role, actions: d.actions })) as any,
      });
    }
    return deltas;
  });

  const next = await getRolePermissions(db);
  return { previous, next };
}

/**
 * Removes all stored permission overrides, reverting to app defaults.
 * Returns the before/after state for audit logging.
 */
export async function resetRolePermissions(
  db: PrismaClient,
): Promise<{ previous: RolePermissions; next: RolePermissions }> {
  const previous = await getRolePermissions(db);
  await db.venueRolePermissions.deleteMany();
  const next = { ...DEFAULT_ROLE_PERMISSIONS } as RolePermissions;
  return { previous, next };
}
