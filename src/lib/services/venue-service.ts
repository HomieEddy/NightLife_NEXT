import { mockVenueService } from "@/lib/mock-services/venue-service";
import { liveVenueService } from "@/lib/live-services/venue-service";
import { isDemoMode } from "@/lib/app-mode";

export type VenueService = typeof mockVenueService;

export const venueService: VenueService = isDemoMode() ? mockVenueService : liveVenueService;
