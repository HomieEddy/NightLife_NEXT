/**
 * mockReservationService — future backend boundary for table reservations.
 * The permanent demo counterpart to PostgreSQL-backed reservations.
 */
import type { Reservation, ReservationStatus } from "@/lib/types";
import { mockReservations } from "@/lib/mock-data/reservations";
import { mockVenue } from "@/lib/mock-data/venue";
import { clone, delay, uid } from "./delay";
import { mockVenueService } from "./venue-service";

let reservations: Reservation[] = clone(mockReservations);

function sortByDate(list: Reservation[]): Reservation[] {
  return [...list].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

async function applyTableStatus(res: Reservation) {
  if (!res.tableId) return;
  if (res.status === "confirmed" || res.status === "requested") {
    await mockVenueService.setTableStatus(res.tableId, "reserved");
  } else if (res.status === "seated") {
    await mockVenueService.setTableStatus(res.tableId, "occupied");
  } else {
    await mockVenueService.setTableStatus(res.tableId, "open");
  }
}

export const mockReservationService = {
  async listReservations(filter?: {
    status?: ReservationStatus[];
    zoneIds?: string[];
    date?: string; // YYYY-MM-DD
  }): Promise<Reservation[]> {
    await delay();
    let result = clone(reservations);
    if (filter?.status?.length) result = result.filter((r) => filter.status!.includes(r.status));
    if (filter?.zoneIds?.length) result = result.filter((r) => r.zoneId && filter.zoneIds!.includes(r.zoneId));
    if (filter?.date) {
      result = result.filter((r) => r.startsAt.slice(0, 10) === filter.date);
    }
    return sortByDate(result);
  },

  async getReservation(id: string): Promise<Reservation | null> {
    await delay(200);
    return clone(reservations.find((r) => r.id === id) ?? null);
  },

  async createReservation(input: {
    tableId?: string;
    zoneId?: string;
    guestName: string;
    partySize: number;
    startsAt: string;
    endsAt?: string;
    note?: string;
    source: "manager" | "public";
  }): Promise<Reservation> {
    await delay(500);
    const reservation: Reservation = {
      id: uid("res"),
      venueId: mockVenue.id,
      tableId: input.tableId,
      zoneId: input.zoneId,
      guestName: input.guestName.trim(),
      partySize: input.partySize,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      status: "requested",
      note: input.note?.trim() || undefined,
      source: input.source,
      createdAt: new Date().toISOString(),
    };
    reservations = [reservation, ...reservations];
    await applyTableStatus(reservation);
    return clone(reservation);
  },

  async updateReservation(
    id: string,
    patch: Partial<Omit<Reservation, "id" | "venueId" | "createdAt">>,
  ): Promise<Reservation | null> {
    await delay(400);
    const res = reservations.find((r) => r.id === id);
    if (!res) return null;
    Object.assign(res, patch);
    await applyTableStatus(res);
    return clone(res);
  },

  async setStatus(id: string, status: ReservationStatus): Promise<Reservation | null> {
    return this.updateReservation(id, { status });
  },

  async cancelReservation(id: string): Promise<Reservation | null> {
    return this.setStatus(id, "cancelled");
  },
};
