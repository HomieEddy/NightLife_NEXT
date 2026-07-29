import { mockPermissionService } from "@/features/platform/permission-mock-service";
import { livePermissionService } from "@/features/platform/permission-live-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/features/shared/app-mode";

export type PermissionService = typeof mockPermissionService;

export const permissionService: PermissionService = isDemoMode()
  ? demoOnlyService(mockPermissionService)
  : liveOnlyService(livePermissionService);
