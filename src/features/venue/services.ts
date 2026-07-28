import { mockVenueService } from "@/features/venue/mock-service";
import { liveVenueService } from "@/features/venue/live-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/features/shared/app-mode";

export type VenueService = typeof mockVenueService;

export const venueService: VenueService = isDemoMode()
  ? demoOnlyService(mockVenueService)
  : liveOnlyService(liveVenueService);
