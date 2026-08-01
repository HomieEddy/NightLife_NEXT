import { mockWaitlistService } from "@/features/door/waitlist-mock-service";
import { liveWaitlistService } from "@/features/door/waitlist-live-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/features/shared/app-mode";

export type WaitlistService = typeof mockWaitlistService;
export type { WaitlistEntryWithPosition } from "@/features/door/waitlist-mock-service";

export const waitlistService: WaitlistService = isDemoMode()
  ? demoOnlyService(mockWaitlistService)
  : liveOnlyService(liveWaitlistService);
