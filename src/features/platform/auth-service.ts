import { mockAuthService } from "@/features/platform/auth-mock-service";
import { liveAuthService } from "@/features/platform/auth-live-service";
import { isDemoMode } from "@/features/shared/app-mode";

export type AuthService = typeof mockAuthService;

export const authService: AuthService = isDemoMode()
  ? mockAuthService
  : liveAuthService;
