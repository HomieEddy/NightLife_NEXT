import { mockGuestsService } from "@/lib/mock-services/guests-service";
import { liveGuestsService } from "@/lib/live-services/guests-service";
import { isDemoMode } from "@/lib/app-mode";

export type GuestsService = typeof mockGuestsService;

export const guestsService: GuestsService = isDemoMode()
  ? mockGuestsService
  : liveGuestsService;
