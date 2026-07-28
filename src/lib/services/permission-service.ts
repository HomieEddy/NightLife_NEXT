import { mockPermissionService } from "@/lib/mock-services/permission-service";
import { livePermissionService } from "@/lib/live-services/permission-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/features/shared/app-mode";

export type PermissionService = typeof mockPermissionService;

export const permissionService: PermissionService = isDemoMode()
  ? demoOnlyService(mockPermissionService)
  : liveOnlyService(livePermissionService);
