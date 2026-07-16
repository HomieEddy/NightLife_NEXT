import { mockReservationService } from "@/lib/mock-services/reservation-service";
import { liveReservationService } from "@/lib/live-services/reservation-service";
import { isDemoMode } from "@/lib/app-mode";

export type ReservationService = typeof mockReservationService;

export const reservationService: ReservationService = isDemoMode()
  ? mockReservationService
  : liveReservationService;
