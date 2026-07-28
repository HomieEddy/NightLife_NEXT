import { mockGuestsService } from "@/features/guests/mock-service";
import { liveGuestsService } from "@/features/guests/live-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/features/shared/app-mode";

export type GuestsService = typeof mockGuestsService;

export const guestsService: GuestsService = isDemoMode()
  ? demoOnlyService(mockGuestsService)
  : liveOnlyService(liveGuestsService);
