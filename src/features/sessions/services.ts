import { mockGuestService } from "@/features/sessions/mock-service";
import { liveGuestService } from "@/features/sessions/live-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/features/shared/app-mode";

export type GuestService = typeof mockGuestService;

export const guestService: GuestService = isDemoMode()
  ? demoOnlyService(mockGuestService)
  : liveOnlyService(liveGuestService);
