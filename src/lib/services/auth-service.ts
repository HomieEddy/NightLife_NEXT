import { mockAuthService } from "@/lib/mock-services/auth-service";

export type AuthService = typeof mockAuthService;

export const authService: AuthService = mockAuthService;
