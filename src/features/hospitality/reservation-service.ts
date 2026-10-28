import { mockReservationService } from "@/features/hospitality/reservation-mock-service";
import { liveReservationService } from "@/features/hospitality/reservation-live-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/features/shared/app-mode";

export type ReservationService = typeof mockReservationService;
export type { PublicAvailability, PublicTableAvailability } from "@/features/hospitality/reservation-mock-service";

export const reservationService: ReservationService = isDemoMode()
  ? demoOnlyService(mockReservationService)
  : liveOnlyService(liveReservationService);
