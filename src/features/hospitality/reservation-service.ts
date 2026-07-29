import { mockReservationService } from "@/features/hospitality/reservation-mock-service";
import { liveReservationService } from "@/features/hospitality/reservation-live-service";
import { isDemoMode } from "@/features/shared/app-mode";

export type ReservationService = typeof mockReservationService;
export type { PublicAvailability, PublicTableAvailability } from "@/features/hospitality/reservation-mock-service";

export const reservationService: ReservationService = isDemoMode()
  ? mockReservationService
  : liveReservationService;
