import { mockStaffService } from "@/lib/mock-services/staff-service";
import { liveStaffService } from "@/lib/live-services/staff-service";
import { isDemoMode } from "@/lib/app-mode";

export type StaffService = typeof mockStaffService;

export const staffService: StaffService = isDemoMode()
  ? mockStaffService
  : liveStaffService;
