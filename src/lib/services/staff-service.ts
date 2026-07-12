import { mockStaffService } from "@/lib/mock-services/staff-service";

export type StaffService = typeof mockStaffService;

export const staffService: StaffService = mockStaffService;
