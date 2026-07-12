import { mockGuestsService } from "@/lib/mock-services/guests-service";

export type GuestsService = typeof mockGuestsService;

export const guestsService: GuestsService = mockGuestsService;
