/**
 * mockReservationService — future backend boundary for table reservations.
 * The permanent demo counterpart to PostgreSQL-backed reservations.
 */
import type { Reservation, ReservationChannel, ReservationStatus, Venue } from "@/lib/types";
import { mockReservations } from "@/features/hospitality/reservation-mock-data";
import { mockVenue } from "@/features/venue/mock-data";
import { canMarkNoShow } from "@/lib/door";
import { clone, delay, uid } from "@/features/shared/delay";
import { mockVenueService } from "@/features/venue/mock-service";

let reservations: Reservation[] = clone(mockReservations);

function sortByDate(list: Reservation[]): Reservation[] {
  return [...list].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Deterministic 6-digit PIN seeded from the reservation id. */
function generatePin(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return String(Math.abs(hash) % 1000000).padStart(6, "0");
}

/**
 * Returns the business-night start instant for a given calendar date in the
 * venue's timezone. A night that opens at 18:00 on Friday stays "Friday's night"
 * until nightEndHour on Saturday morning.
 */
function nightStartInstant(date: string, venue: Venue): Date {
  const [y, m, d] = date.split("-").map(Number);
  const dtStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(venue.nightStartHour).padStart(2, "0")}:00:00`;
  const inTz = new Date(
    new Date(dtStr + "Z").getTime() +
      getTimezoneOffsetMs(venue.timezone, new Date(dtStr + "Z")),
  );
  return inTz;
}

function getTimezoneOffsetMs(tz: string, ref: Date): number {
  const utcStr = ref.toLocaleString("en-US", { timeZone: "UTC" });
  const tzStr = ref.toLocaleString("en-US", { timeZone: tz });
  return new Date(utcStr).getTime() - new Date(tzStr).getTime();
}

/** Is the venue's night already open for this date? */
function isNightOpen(date: string, venue: Venue, now = new Date()): boolean {
  return now >= nightStartInstant(date, venue);
}

/** INV: at most one confirmed/seated reservation per table per night. */
function hasConfirmedForNight(tableId: string, date: string): boolean {
  return reservations.some(
    (r) =>
      r.tableId === tableId &&
      r.startsAt.slice(0, 10) === date &&
      (r.status === "confirmed" || r.status === "seated"),
  );
}

async function applyTableStatus(res: Reservation) {
  if (!res.tableId) return;
  if (res.status === "confirmed" || res.status === "requested") {
    await mockVenueService.setTableStatus(res.tableId, "reserved");
  } else if (res.status === "seated") {
    await mockVenueService.setTableStatus(res.tableId, "occupied");
  } else {
    // cancelled, completed, no-show — all release the table.
    await mockVenueService.setTableStatus(res.tableId, "open");
  }
}

export interface PublicTableAvailability {
  id: string;
  code: string;
  label: string;
  seats: number;
  minimumSpend: number | null;
  mapX?: number;
  mapY?: number;
  zoneId: string;
  available: boolean;
}

export interface PublicAvailability {
  venue: { id: string; name: string; publicSlug: string; floorMap: Venue["floorMap"]; timezone: string; nightStartHour: number; nightEndHour: number; currency: Venue["currency"] };
  zones: { id: string; name: string; color: string }[];
  tables: PublicTableAvailability[];
  nightOpen: boolean;
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

  async listMyReservations(promoterId: string): Promise<Reservation[]> {
    await delay();
    return sortByDate(clone(reservations.filter((r) => r.promoterId === promoterId)));
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
    channel?: ReservationChannel;
    guestEmail?: string;
    guestPhone?: string;
    eventId?: string;
    promoterId?: string;
    guestProfileId?: string;
    expectedDurationMinutes?: number;
    depositTermsNote?: string;
    cancellationPolicyNote?: string;
    seatingNumber?: 1 | 2;
  }): Promise<Reservation> {
    await delay(500);
    const reservation: Reservation = {
      id: uid("res"),
      venueId: mockVenue.id,
      tableId: input.tableId,
      zoneId: input.zoneId,
      eventId: input.eventId,
      guestName: input.guestName.trim(),
      partySize: input.partySize,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      status: "requested",
      note: input.note?.trim() || undefined,
      source: input.source,
      channel: input.channel,
      guestEmail: input.guestEmail?.trim() || undefined,
      guestPhone: input.guestPhone?.trim() || undefined,
      promoterId: input.promoterId,
      guestProfileId: input.guestProfileId,
      expectedDurationMinutes: input.expectedDurationMinutes,
      depositTermsNote: input.depositTermsNote?.trim() || undefined,
      cancellationPolicyNote: input.cancellationPolicyNote?.trim() || undefined,
      seatingNumber: input.seatingNumber,
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

    const oldStatus = res.status;
    Object.assign(res, patch);
    const newStatus = res.status;

    // PIN lifecycle: mint on confirm, clear on seat/cancel/complete
    if (oldStatus !== newStatus) {
      if (newStatus === "confirmed" && res.tableId) {
        const date = res.startsAt.slice(0, 10);
        if (hasConfirmedForNight(res.tableId, date) && reservations.find((r) => r.id === id)!.status !== "confirmed") {
          // Double-claim: revert and throw
          res.status = oldStatus;
          throw new Error(`${res.tableId} already confirmed for tonight`);
        }
        res.reservationPin = generatePin(res.id);
        // TODO(backend): send PIN via email/SMS on confirm
      } else if (["seated", "cancelled", "completed", "no-show"].includes(newStatus)) {
        res.reservationPin = undefined;
      }
    }

    await applyTableStatus(res);
    return clone(res);
  },

  async setStatus(id: string, status: ReservationStatus): Promise<Reservation | null> {
    return this.updateReservation(id, { status });
  },

  async cancelReservation(id: string): Promise<Reservation | null> {
    return this.setStatus(id, "cancelled");
  },

  /** Gated to confirmed reservations only (INV: no-show is not reachable from requested/seated/etc). */
  async markNoShow(id: string): Promise<Reservation | null> {
    const current = reservations.find((r) => r.id === id);
    if (!current) return null;
    if (!canMarkNoShow(current.status)) {
      throw new Error("Only a confirmed reservation can be marked no-show");
    }
    return this.updateReservation(id, { status: "no-show" });
  },

  /** RV-02: Check whether booking this party would exceed the venue's legal capacity at the given date/time. */
  async checkCapacityForBooking(
    date: string,
    partySize: number,
  ): Promise<{ allowed: boolean; currentBooked: number; legalCapacity: number }> {
    await delay(200);
    const venue = await mockVenueService.getVenue();
    const booked = reservations
      .filter((r) => r.startsAt.slice(0, 10) === date && (r.status === "confirmed" || r.status === "seated"))
      .reduce((s, r) => s + r.partySize, 0);
    return {
      allowed: (booked + partySize) <= venue.legalCapacity,
      currentBooked: booked,
      legalCapacity: venue.legalCapacity,
    };
  },

  // ── Public embed surface ─────────────────────────────────────

  async getPublicAvailability(
    venueSlug: string,
    opts: { date: string; eventId?: string },
  ): Promise<PublicAvailability | null> {
    await delay(300);
    const v = await mockVenueService.getVenue();
    if (v.publicSlug !== venueSlug) return null;

    const allZones = await mockVenueService.listZones();
    const allTables = await mockVenueService.listTables();

    const bookedTableIds = new Set(
      reservations
        .filter(
          (r) =>
            r.startsAt.slice(0, 10) === opts.date &&
            (r.status === "confirmed" || r.status === "seated") &&
            r.tableId,
        )
        .map((r) => r.tableId!),
    );

    const tables: PublicTableAvailability[] = allTables
      .filter((t) => t.status !== "closed")
      .map((t) => ({
        id: t.id,
        code: t.code,
        label: t.label,
        seats: t.seats,
        minimumSpend: t.minimumSpend,
        mapX: t.mapX,
        mapY: t.mapY,
        zoneId: t.zoneId,
        available: !bookedTableIds.has(t.id),
      }));

    return {
      venue: {
        id: v.id,
        name: v.name,
        publicSlug: v.publicSlug,
        floorMap: v.floorMap,
        timezone: v.timezone,
        nightStartHour: v.nightStartHour,
        nightEndHour: v.nightEndHour,
        currency: v.currency,
      },
      zones: allZones.map((z) => ({ id: z.id, name: z.name, color: z.color })),
      tables,
      nightOpen: isNightOpen(opts.date, v),
    };
  },

  async createPublicReservation(input: {
    venueSlug: string;
    tableId: string;
    zoneId: string;
    guestName: string;
    partySize: number;
    date: string;
    guestEmail?: string;
    guestPhone?: string;
    note?: string;
    eventId?: string;
  }): Promise<Reservation> {
    const v = await mockVenueService.getVenue();
    if (v.publicSlug !== input.venueSlug) {
      throw new Error("Venue not found");
    }
    if (isNightOpen(input.date, v)) {
      throw new Error("Reservations for tonight are closed");
    }
    if (!input.guestEmail && !input.guestPhone) {
      throw new Error("Email or phone is required");
    }

    const startsAt = `${input.date}T${String(v.nightStartHour).padStart(2, "0")}:00:00`;

    return this.createReservation({
      tableId: input.tableId,
      zoneId: input.zoneId,
      guestName: input.guestName,
      partySize: input.partySize,
      startsAt,
      source: "public",
      channel: "embed",
      guestEmail: input.guestEmail,
      guestPhone: input.guestPhone,
      note: input.note,
      eventId: input.eventId,
    });
  },

  /** Check if a table has an active confirmed reservation right now (for QR gate). */
  async getActiveReservationForTable(tableId: string): Promise<Reservation | null> {
    await delay(200);
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const active = reservations.find((r) => {
      if (r.tableId !== tableId || r.status !== "confirmed") return false;
      // Compare using local date of the reservation start
      const d = new Date(r.startsAt);
      const resLocal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return resLocal === localToday;
    });
    return active ? clone(active) : null;
  },

  /** Validate a PIN for a reserved table and seat the reservation. */
  async validatePinAndSeat(
    tableId: string,
    pin: string,
  ): Promise<{ ok: boolean; error?: string }> {
    await delay(300);
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const active = reservations.find((r) => {
      if (r.tableId !== tableId || r.status !== "confirmed") return false;
      const d = new Date(r.startsAt);
      const resLocal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return resLocal === localToday;
    });
    if (!active) return { ok: false, error: "No active reservation" };
    if (active.reservationPin !== pin) return { ok: false, error: "Invalid PIN" };

    active.status = "seated";
    active.reservationPin = undefined;
    await applyTableStatus(active);
    return { ok: true };
  },
};
