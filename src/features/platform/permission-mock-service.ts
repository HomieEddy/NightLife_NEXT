import { delay, clone } from "@/features/shared/delay";
import { DEFAULT_ROLE_PERMISSIONS } from "@/features/shared/permissions";
import type { RolePermissions } from "@/features/shared/permissions";

// Per-venue in-memory overrides — resets on page reload (permanent demo sandbox behaviour).
const venueOverrides = new Map<string, RolePermissions>();

export const mockPermissionService = {
  /**
   * Returns the active permission matrix for the venue.
   * Demo: returns any in-memory override set by the manager, otherwise defaults.
   * Live: queries venue_role_permissions table, merges over DEFAULT_ROLE_PERMISSIONS.
   */
  async getRolePermissions(venueId: string): Promise<RolePermissions> {
    await delay(0);
    return clone(venueOverrides.get(venueId) ?? DEFAULT_ROLE_PERMISSIONS);
  },

  /**
   * Saves a custom permission matrix for a venue.
   * Demo: in-memory only — resets on reload.
   * Live: upserts deltas into venue_role_permissions, invalidates TanStack Query cache.
   */
  async setRolePermissions(venueId: string, permissions: RolePermissions): Promise<void> {
    await delay(80);
    venueOverrides.set(venueId, clone(permissions));
  },

  /** Resets a venue's custom matrix, reverting all roles to app defaults. */
  async resetRolePermissions(venueId: string): Promise<void> {
    await delay(60);
    venueOverrides.delete(venueId);
  },
};
