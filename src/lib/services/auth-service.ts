import { mockAuthService } from "@/lib/mock-services/auth-service";
import { liveAuthService } from "@/lib/live-services/auth-service";
import { isDemoMode } from "@/features/shared/app-mode";

export type AuthService = typeof mockAuthService;

export const authService: AuthService = isDemoMode()
  ? mockAuthService
  : liveAuthService;
