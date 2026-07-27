import { mockReservationService } from "@/lib/mock-services/reservation-service";
import { liveReservationService } from "@/lib/live-services/reservation-service";
import { isDemoMode } from "@/lib/app-mode";

export type ReservationService = typeof mockReservationService;
export type { PublicAvailability, PublicTableAvailability } from "@/lib/mock-services/reservation-service";

export const reservationService: ReservationService = isDemoMode()
  ? mockReservationService
  : liveReservationService;
