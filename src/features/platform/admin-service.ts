import { mockAdminService } from "@/features/platform/admin-mock-service";
import { liveAdminService } from "@/features/platform/admin-live-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/features/shared/app-mode";

export type AdminService = typeof mockAdminService;

export const adminService: AdminService = isDemoMode()
  ? demoOnlyService(mockAdminService)
  : liveOnlyService(liveAdminService);
