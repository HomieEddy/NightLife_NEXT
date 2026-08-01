import { mockStaffService } from "@/features/workforce/staff-mock-service";
import { liveStaffService } from "@/features/workforce/staff-live-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/features/shared/app-mode";

export type StaffService = typeof mockStaffService;

export const staffService: StaffService = isDemoMode()
  ? demoOnlyService(mockStaffService)
  : liveOnlyService(liveStaffService);
