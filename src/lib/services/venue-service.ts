import { mockVenueService } from "@/lib/mock-services/venue-service";

export type VenueService = typeof mockVenueService;

export const venueService: VenueService = mockVenueService;
