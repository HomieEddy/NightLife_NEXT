"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { permissionService } from "@/features/platform/permission-service";
import { permissionsKeys } from "@/features/platform/query-keys";
import { staffService } from "@/features/workforce/staff-service";
import { staffKeys } from "@/features/workforce/query-keys";
import {
  canDo,
  type StaffAction,
  type RolePermissions,
  type ResourceContext,
} from "@/features/shared/permissions";
import type { StaffRole } from "@/lib/types";

export interface UsePermissions {
  /**
   * Fails CLOSED — returns false while permissions/identity are loading or
   * absent. Gate a disabled-button flash on `isLoading`, never on `can()`.
   */
  can: (action: StaffAction, resource?: ResourceContext) => boolean;
  permissions: RolePermissions | undefined;
  role: StaffRole | null;
  staffId: string | null;
  isLoading: boolean;
}

/**
 * The single client entry point for role permissions. Owns the permissions and
 * current-staff queries (venueId comes from the session via useAuth — no
 * hardcoded "venue-1"). The staff query reuses staffKeys.me so it dedupes with
 * any page that already reads current staff.
 */
export function usePermissions(): UsePermissions {
  const { user } = useAuth();
  const venueId = user?.venueId ?? "";

  const { data: permissions, isLoading: permLoading } = useQuery({
    queryKey: permissionsKeys.role(venueId),
    queryFn: () => permissionService.getRolePermissions(venueId),
    enabled: !!venueId,
  });

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: staffKeys.me(venueId),
    queryFn: () => staffService.getCurrentStaff(),
    enabled: !!venueId,
  });

  const can = useMemo(() => {
    return (action: StaffAction, resource?: ResourceContext): boolean => {
      if (!permissions || !me) return false; // fail closed
      const ctx = resource
        ? { actor: { staffId: me.id, assignedZoneIds: me.assignedZoneIds }, resource }
        : undefined;
      return canDo(permissions, me.role, action, ctx);
    };
  }, [permissions, me]);

  return {
    can,
    permissions,
    role: me?.role ?? null,
    staffId: me?.id ?? null,
    isLoading: !venueId || permLoading || meLoading,
  };
}
