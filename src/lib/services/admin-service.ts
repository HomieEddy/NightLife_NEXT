import { mockAdminService } from "@/lib/mock-services/admin-service";

export type AdminService = typeof mockAdminService;

export const adminService: AdminService = mockAdminService;
