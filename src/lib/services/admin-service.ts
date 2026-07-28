import { mockAdminService } from "@/lib/mock-services/admin-service";
import { liveAdminService } from "@/lib/live-services/admin-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/features/shared/app-mode";

export type AdminService = typeof mockAdminService;

export const adminService: AdminService = isDemoMode()
  ? demoOnlyService(mockAdminService)
  : liveOnlyService(liveAdminService);
