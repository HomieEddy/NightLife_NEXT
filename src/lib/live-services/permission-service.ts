import { DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions";
import type { RolePermissions } from "@/lib/permissions";

/**
 * Live permission service — reads per-venue role overrides from the database.
 *
 * TODO(backend): replace body with Prisma queries against venue_role_permissions.
 * Schema: (id, venueId, role, actions String[]) — one row per role that differs from defaults.
 * Merge strategy: start from DEFAULT_ROLE_PERMISSIONS, apply any stored rows on top.
 * Cache the result per-request (or per-session) to avoid N+1 on every canDo call.
 */
export const livePermissionService = {
  async getRolePermissions(_venueId: string): Promise<RolePermissions> {
    // Stub: returns defaults until the venue_role_permissions table is implemented.
    return structuredClone(DEFAULT_ROLE_PERMISSIONS);
  },

  async setRolePermissions(_venueId: string, _permissions: RolePermissions): Promise<void> {
    throw new Error("setRolePermissions not yet implemented for the live track.");
  },

  async resetRolePermissions(_venueId: string): Promise<void> {
    throw new Error("resetRolePermissions not yet implemented for the live track.");
  },
};
