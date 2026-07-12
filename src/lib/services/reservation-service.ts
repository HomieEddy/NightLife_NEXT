import { mockReservationService } from "@/lib/mock-services/reservation-service";

export type ReservationService = typeof mockReservationService;

export const reservationService: ReservationService = mockReservationService;
