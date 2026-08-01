"use client";

import type { ReactNode } from "react";
import { usePermissions } from "@/features/platform/use-permissions";
import type { StaffAction, ResourceContext } from "@/features/shared/permissions";

/**
 * Renders `children` only when the signed-in staffer may perform `action`.
 * Fails closed (renders `fallback`) while permissions load. Use for conditional
 * UI blocks; for a disabled prop, use the boolean `can()` from usePermissions.
 */
export function Can({
  action,
  resource,
  children,
  fallback = null,
}: {
  action: StaffAction;
  resource?: ResourceContext;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can } = usePermissions();
  return <>{can(action, resource) ? children : fallback}</>;
}
