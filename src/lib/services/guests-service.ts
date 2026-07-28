import { mockGuestsService } from "@/lib/mock-services/guests-service";
import { liveGuestsService } from "@/lib/live-services/guests-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/features/shared/app-mode";

export type GuestsService = typeof mockGuestsService;

export const guestsService: GuestsService = isDemoMode()
  ? demoOnlyService(mockGuestsService)
  : liveOnlyService(liveGuestsService);
