import { mockWaitlistService } from "@/lib/mock-services/waitlist-service";
import { liveWaitlistService } from "@/lib/live-services/waitlist-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/lib/app-mode";

export type WaitlistService = typeof mockWaitlistService;

export const waitlistService: WaitlistService = isDemoMode()
  ? demoOnlyService(mockWaitlistService)
  : liveOnlyService(liveWaitlistService);
