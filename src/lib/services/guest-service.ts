import { mockGuestService } from "@/lib/mock-services/guest-service";
import { liveGuestService } from "@/lib/live-services/guest-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/lib/app-mode";

export type GuestService = typeof mockGuestService;

export const guestService: GuestService = isDemoMode()
  ? demoOnlyService(mockGuestService)
  : liveOnlyService(liveGuestService);
