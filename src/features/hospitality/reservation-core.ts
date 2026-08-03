/**
 * Reservation lifecycle: CRUD + status transitions + table-status integration.
 * confirm → table "reserved"; seat → "occupied"; cancel/complete → release.
 * The table-flip happens in the same transaction as the status write.
 */
import type { getDb } from "@/features/shared/db";
import { getRawPrisma } from "@/features/shared/db";
import type { BlackoutDate, Reservation, ReservationChannel, ReservationStatus } from "@/lib/types";
import type { z } from "zod";
import type { zReservationInput, zReservationPatch, zListReservations } from "@/features/hospitality/reservation-schemas";

type ScopedDb = ReturnType<typeof getDb>;

/** Prisma stores the enum value as "no_show"; the app contracts use "no-show". */
export function normalizeStatus(raw: string): ReservationStatus {
  if (raw === "no_show") return "no-show";
  return raw as ReservationStatus;
}

export function prismaStatus(status: ReservationStatus): string {
  return status === "no-show" ? "no_show" : status;
}

function toReservation(row: {
  id: string;
  venueId: string;
  tableId: string | null;
  zoneId: string | null;
  eventId: string | null;
  guestName: string;
  partySize: number;
  startsAt: Date;
  endsAt: Date | null;
  status: string;
  note: string | null;
  source: string;
  channel: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  reservationPin: string | null;
  promoterId: string | null;
  packageId: string | null;
  minimumSpendCents: number | null;
  expectedDurationMinutes: number | null;
  depositTermsNote: string | null;
  cancellationPolicyNote: string | null;
  seatingNumber: number | null;
  guestProfileId: string | null;
  holdUntil: Date | null;
  bumpedFromId: string | null;
  bumpReason: string | null;
  alternativeTableId: string | null;
  createdAt: Date;
}): Reservation {
  return {
    id: row.id,
    venueId: row.venueId,
    tableId: row.tableId ?? undefined,
    zoneId: row.zoneId ?? undefined,
    eventId: row.eventId ?? undefined,
    guestName: row.guestName,
    partySize: row.partySize,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt?.toISOString(),
    status: normalizeStatus(row.status),
    note: row.note ?? undefined,
    source: row.source as Reservation["source"],
    channel: (row.channel ?? undefined) as ReservationChannel | undefined,
    guestEmail: row.guestEmail ?? undefined,
    guestPhone: row.guestPhone ?? undefined,
    reservationPin: row.reservationPin ?? undefined,
    promoterId: row.promoterId ?? undefined,
    packageId: row.packageId ?? undefined,
    minimumSpendCents: row.minimumSpendCents ?? undefined,
    expectedDurationMinutes: row.expectedDurationMinutes ?? undefined,
    depositTermsNote: row.depositTermsNote ?? undefined,
    cancellationPolicyNote: row.cancellationPolicyNote ?? undefined,
    seatingNumber: (row.seatingNumber === null ? undefined : row.seatingNumber) as 1 | 2 | undefined,
    guestProfileId: row.guestProfileId ?? undefined,
    holdUntil: row.holdUntil?.toISOString(),
    bumpedFromId: row.bumpedFromId ?? undefined,
    bumpReason: row.bumpReason ?? undefined,
    alternativeTableId: row.alternativeTableId ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

// Prisma select/include for all reservation fields
const reservationSelect = {
  id: true,
  venueId: true,
  tableId: true,
  zoneId: true,
  eventId: true,
  guestName: true,
  partySize: true,
  startsAt: true,
  endsAt: true,
  status: true,
  note: true,
  source: true,
  channel: true,
  guestEmail: true,
  guestPhone: true,
  reservationPin: true,
  promoterId: true,
  packageId: true,
  minimumSpendCents: true,
  expectedDurationMinutes: true,
  depositTermsNote: true,
  cancellationPolicyNote: true,
  seatingNumber: true,
  guestProfileId: true,
  holdUntil: true,
  bumpedFromId: true,
  bumpReason: true,
  alternativeTableId: true,
  bookingLocale: true,
  createdAt: true,
} as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildReservationData(input: any, isCreate: boolean) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (input.guestName !== undefined) data.guestName = input.guestName.trim();
  if (input.partySize !== undefined) data.partySize = input.partySize;
  if (input.startsAt !== undefined) data.startsAt = new Date(input.startsAt);
  if (input.endsAt !== undefined) data.endsAt = input.endsAt ? new Date(input.endsAt) : null;
  if (input.note !== undefined) data.note = input.note?.trim() || null;
  if (input.tableId !== undefined) data.tableId = input.tableId || null;
  if (input.zoneId !== undefined) data.zoneId = input.zoneId || null;
  if (input.source !== undefined) data.source = input.source;
  if (input.channel !== undefined) data.channel = input.channel || null;
  if (input.guestEmail !== undefined) data.guestEmail = input.guestEmail?.trim() || null;
  if (input.guestPhone !== undefined) data.guestPhone = input.guestPhone?.trim() || null;
  if (input.eventId !== undefined) data.eventId = input.eventId || null;
  if (input.promoterId !== undefined) data.promoterId = input.promoterId || null;
  if (input.guestProfileId !== undefined) data.guestProfileId = input.guestProfileId || null;
  if (input.packageId !== undefined) data.packageId = input.packageId || null;
  if (input.minimumSpendCents !== undefined) data.minimumSpendCents = input.minimumSpendCents;
  if (input.expectedDurationMinutes !== undefined) data.expectedDurationMinutes = input.expectedDurationMinutes;
  if (input.depositTermsNote !== undefined) data.depositTermsNote = input.depositTermsNote?.trim() || null;
  if (input.cancellationPolicyNote !== undefined) data.cancellationPolicyNote = input.cancellationPolicyNote?.trim() || null;
  if (input.seatingNumber !== undefined) data.seatingNumber = input.seatingNumber || null;
  if (input.holdUntil !== undefined) data.holdUntil = input.holdUntil ? new Date(input.holdUntil) : null;
  if (input.bookingLocale !== undefined) data.bookingLocale = input.bookingLocale;
  return data;
}

export async function listReservations(
  db: ScopedDb,
  filter?: z.infer<typeof zListReservations>,
): Promise<Reservation[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (filter?.status?.length) where.status = { in: filter.status.map(prismaStatus) };
  if (filter?.zoneIds?.length) where.zoneId = { in: filter.zoneIds };
  if (filter?.date) {
    const start = new Date(filter.date + "T00:00:00Z");
    const end = new Date(filter.date + "T23:59:59.999Z");
    where.startsAt = { gte: start, lte: end };
  }
  if (filter?.promoterId) where.promoterId = filter.promoterId;

  const rows = await db.reservation.findMany({
    where,
    select: reservationSelect,
    orderBy: { startsAt: "asc" },
  });
  return rows.map(toReservation);
}

export async function getReservation(
  db: ScopedDb,
  id: string,
): Promise<Reservation | null> {
  const row = await db.reservation.findUnique({ where: { id }, select: reservationSelect });
  return row ? toReservation(row) : null;
}

export async function createReservation(
  db: ScopedDb,
  venueId: string,
  input: z.infer<typeof zReservationInput>,
): Promise<Reservation> {
  const data = {
    venueId,
    tableId: input.tableId ?? null,
    zoneId: input.zoneId ?? null,
    eventId: input.eventId ?? null,
    guestName: input.guestName.trim(),
    partySize: input.partySize,
    startsAt: new Date(input.startsAt),
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
    status: "requested" as const,
    note: input.note?.trim() || null,
    source: input.source,
    channel: input.channel ?? null,
    guestEmail: input.guestEmail?.trim() || null,
    guestPhone: input.guestPhone?.trim() || null,
    promoterId: input.promoterId ?? null,
    guestProfileId: input.guestProfileId ?? null,
    packageId: input.packageId ?? null,
    minimumSpendCents: input.minimumSpendCents ?? null,
    expectedDurationMinutes: input.expectedDurationMinutes ?? null,
    depositTermsNote: input.depositTermsNote?.trim() || null,
    cancellationPolicyNote: input.cancellationPolicyNote?.trim() || null,
    seatingNumber: input.seatingNumber ?? null,
    bookingLocale: input.bookingLocale ?? "en",
    // Consent is validated on the public booking form (zPublicReservationInput);
    // stamp the evidence here, server-side, at the moment of creation.
    consentAt: input.source === "public" ? new Date() : null,
  };
  const row = await db.reservation.create({ data, select: reservationSelect });
  return toReservation(row);
}

export async function updateReservation(
  db: ScopedDb,
  id: string,
  patch: z.infer<typeof zReservationPatch>,
): Promise<Reservation | null> {
  const data = buildReservationData(patch, false);
  const row = await db.reservation.update({ where: { id }, data, select: reservationSelect }).catch(() => null);
  return row ? toReservation(row) : null;
}

// Table status that a reservation status implies
export function tableStatusFor(status: ReservationStatus): "reserved" | "occupied" | "open" | null {
  if (status === "confirmed" || status === "requested") return "reserved";
  if (status === "seated") return "occupied";
  if (status === "cancelled" || status === "completed" || status === "no-show") return "open";
  return null;
}

/**
 * Transition reservation status with atomic table-flip.
 * Rejects seating a table that another reservation already holds.
 */
export async function setReservationStatus(
  db: ScopedDb,
  venueId: string,
  id: string,
  status: ReservationStatus,
): Promise<{ ok: true; reservation: Reservation } | { ok: false; error: string }> {
  const prisma = getRawPrisma();

  try {
    const row = await prisma.$transaction(async (tx) => {
      const current = await tx.reservation.findFirst({
        where: { id, venueId },
        select: { ...reservationSelect, id: true, venueId: true, tableId: true, status: true },
      });
      if (!current) throw new Error("Reservation not found");

      // If seating, verify the table isn't held by another reservation
      if (status === "seated" && current.tableId) {
        const conflict = await tx.reservation.findFirst({
          where: {
            venueId,
            tableId: current.tableId,
            status: "seated",
            id: { not: id },
          },
        });
        if (conflict) {
          throw new Error(`Table already seated by reservation for ${conflict.guestName}`);
        }
      }

      // If confirming, enforce INV: at most one confirmed/seated per table per night
      if (status === "confirmed" && current.tableId) {
        const night = current.startsAt.toISOString().slice(0, 10);
        const start = new Date(night + "T00:00:00Z");
        const end = new Date(night + "T23:59:59.999Z");
        const conflict = await tx.reservation.findFirst({
          where: {
            venueId,
            tableId: current.tableId,
            status: { in: ["confirmed", "seated"] },
            startsAt: { gte: start, lte: end },
            id: { not: id },
          },
        });
        if (conflict) {
          throw new Error(`${current.tableId} already confirmed for tonight`);
        }
      }

      // PIN lifecycle: mint on confirm, clear on seat/cancel/complete/no-show
      const data: Record<string, unknown> = { status: prismaStatus(status) };
      if (status === "confirmed") {
        // Generate 6-digit PIN from reservation id
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
          hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
        }
        data.reservationPin = String(Math.abs(hash) % 1000000).padStart(6, "0");
      } else if (["seated", "cancelled", "completed", "no-show"].includes(status)) {
        data.reservationPin = null;
      }

      const updated = await tx.reservation.update({
        where: { id },
        data,
        select: reservationSelect,
      });

      // Flip table status in the same transaction
      const targetTableStatus = tableStatusFor(status);
      if (updated.tableId && targetTableStatus) {
        if (targetTableStatus === "open") {
          const table = await tx.venueTable.findUnique({
            where: { id: updated.tableId },
          });
          if (table && (table.status === "reserved" || table.status === "occupied")) {
            await tx.venueTable.update({
              where: { id: updated.tableId },
              data: { status: targetTableStatus },
            });
          }
        } else {
          await tx.venueTable.update({
            where: { id: updated.tableId },
            data: { status: targetTableStatus },
          });
        }
      }

      return updated;
    });

    return { ok: true, reservation: toReservation(row) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ── Blackout dates ─────────────────────────────────────────────────

function toBlackoutDate(row: {
  id: string;
  venueId: string;
  date: string;
  reason: string;
  zoneId: string | null;
  createdAt: Date;
}): BlackoutDate {
  return {
    id: row.id,
    venueId: row.venueId,
    date: row.date,
    reason: row.reason,
    zoneId: row.zoneId ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listBlackoutDates(db: ScopedDb): Promise<BlackoutDate[]> {
  const rows = await db.blackoutDate.findMany({ orderBy: { date: "asc" } });
  return rows.map(toBlackoutDate);
}

export async function createBlackoutDate(
  db: ScopedDb,
  venueId: string,
  input: { date: string; reason: string; zoneId?: string },
): Promise<BlackoutDate> {
  const row = await db.blackoutDate.create({
    data: {
      venueId,
      date: input.date,
      reason: input.reason.trim(),
      zoneId: input.zoneId ?? null,
    },
  });
  return toBlackoutDate(row);
}

export async function deleteBlackoutDate(db: ScopedDb, id: string): Promise<void> {
  await db.blackoutDate.delete({ where: { id } }).catch(() => undefined);
}

export async function isDateBlackedOut(
  db: ScopedDb,
  date: string,
  zoneId?: string,
): Promise<boolean> {
  const count = await db.blackoutDate.count({
    where: {
      date,
      OR: [{ zoneId: null }, ...(zoneId ? [{ zoneId }] : [])],
    },
  });
  return count > 0;
}

// ── Bump ──────────────────────────────────────────────────────────

export async function bumpReservation(
  db: ScopedDb,
  venueId: string,
  reservationId: string,
  input: { reason: string; alternativeTableId?: string; byStaffId: string; byStaffName: string },
): Promise<Reservation> {
  const prisma = getRawPrisma();
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.reservation.findFirst({
      where: { id: reservationId, venueId },
      select: reservationSelect,
    });
    if (!current) throw new Error("Reservation not found");
    if (current.status !== "confirmed") throw new Error("Only confirmed reservations can be bumped");

    const updated = await tx.reservation.update({
      where: { id: reservationId },
      data: {
        status: "cancelled",
        bumpReason: input.reason,
        alternativeTableId: input.alternativeTableId ?? null,
      },
      select: reservationSelect,
    });

    // Release the table
    if (updated.tableId) {
      await tx.venueTable.update({
        where: { id: updated.tableId },
        data: { status: "open" },
      });
    }

    return updated;
  });
  return toReservation(result);
}

// ── Public availability ──────────────────────────────────────────

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

export interface PublicAvailabilityResult {
  venue: { id: string; name: string; publicSlug: string; floorMap: unknown; timezone: string; nightStartHour: number; nightEndHour: number; currency: unknown };
  zones: { id: string; name: string; color: string }[];
  tables: PublicTableAvailability[];
  nightOpen: boolean;
}

export async function getPublicAvailability(
  db: ScopedDb,
  venueSlug: string,
  opts: { date: string; eventId?: string },
): Promise<PublicAvailabilityResult | null> {
  const venue = await db.venue.findFirst({ where: { publicSlug: venueSlug } });
  if (!venue) return null;

  // Check for venue-wide blackout
  const venueBlocked = await db.blackoutDate.count({
    where: { venueId: venue.id, date: opts.date, zoneId: null },
  });
  if (venueBlocked > 0) return null;

  const blackedOutZoneIds = new Set(
    (await db.blackoutDate.findMany({
      where: { venueId: venue.id, date: opts.date, zoneId: { not: null } },
      select: { zoneId: true },
    })).map((b) => b.zoneId!).filter(Boolean),
  );

  const zones = await db.zone.findMany({ where: { venueId: venue.id } });
  const tables = await db.venueTable.findMany({
    where: { venueId: venue.id, status: { not: "closed" } },
  });

  const bookedTableIds = new Set(
    (await db.reservation.findMany({
      where: {
        venueId: venue.id,
        status: { in: ["confirmed", "seated"] },
        startsAt: {
          gte: new Date(opts.date + "T00:00:00Z"),
          lte: new Date(opts.date + "T23:59:59.999Z"),
        },
        tableId: { not: null },
      },
      select: { tableId: true },
    })).map((r) => r.tableId!).filter(Boolean),
  );

  // Night-open check in venue timezone
  const [y, m, d] = opts.date.split("-").map(Number);
  const dtStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(venue.nightStartHour).padStart(2, "0")}:00:00`;
  const nightOpen = new Date() >= new Date(dtStr + "Z");

  // Venue name lives on Organization (1:1 via venue.id)
  const prisma = getRawPrisma();
  const org = await prisma.organization.findUnique({ where: { id: venue.id }, select: { name: true } });

  return {
    venue: {
      id: venue.id,
      name: org?.name ?? venue.id,
      publicSlug: venue.publicSlug ?? "",
      floorMap: venue.floorMap,
      timezone: venue.timezone,
      nightStartHour: venue.nightStartHour,
      nightEndHour: venue.nightEndHour,
      currency: venue.currency,
    },
    zones: zones.map((z) => ({ id: z.id, name: z.name, color: z.color })),
    tables: tables.map((t) => ({
      id: t.id,
      code: t.code,
      label: t.label,
      seats: t.seats,
      minimumSpend: t.minimumSpend,
      mapX: t.mapX ?? undefined,
      mapY: t.mapY ?? undefined,
      zoneId: t.zoneId,
      available: !bookedTableIds.has(t.id) && !blackedOutZoneIds.has(t.zoneId),
    })),
    nightOpen,
  };
}

// ── Public reservation creation ───────────────────────────────────

export async function createPublicReservation(
  db: ScopedDb,
  input: {
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
  },
): Promise<Reservation> {
  const venue = await db.venue.findFirst({ where: { publicSlug: input.venueSlug } });
  if (!venue) throw new Error("Venue not found");

  // Night-open cutoff
  const dtStr = `${input.date}T${String(venue.nightStartHour).padStart(2, "0")}:00:00`;
  if (new Date() >= new Date(dtStr + "Z")) {
    throw new Error("Reservations for tonight are closed");
  }

  if (!input.guestEmail && !input.guestPhone) {
    throw new Error("Email or phone is required");
  }

  const startsAt = `${input.date}T${String(venue.nightStartHour).padStart(2, "0")}:00:00`;

  return createReservation(db, venue.id, {
    tableId: input.tableId,
    zoneId: input.zoneId,
    guestName: input.guestName,
    partySize: input.partySize,
    startsAt,
    note: input.note,
    source: "public",
    channel: "embed",
    guestEmail: input.guestEmail,
    guestPhone: input.guestPhone,
    // A guest booking through the venue's embed gets the venue's default
    // language for confirmation/PIN/reminder messages.
    bookingLocale: venue.guestLocale === "fr" ? "fr" : "en",
    eventId: input.eventId,
  });
}

// ── Active reservation for a table (QR gate) ──────────────────────

export async function getActiveReservationForTable(
  db: ScopedDb,
  tableId: string,
): Promise<Reservation | null> {
  const today = new Date().toISOString().slice(0, 10);
  const row = await db.reservation.findFirst({
    where: {
      tableId,
      status: "confirmed",
      startsAt: {
        gte: new Date(today + "T00:00:00Z"),
        lte: new Date(today + "T23:59:59.999Z"),
      },
    },
    select: reservationSelect,
    orderBy: { startsAt: "asc" },
  });
  return row ? toReservation(row) : null;
}

// ── PIN validation & seat ─────────────────────────────────────────

export async function validatePinAndSeat(
  db: ScopedDb,
  tableId: string,
  pin: string,
): Promise<{ ok: boolean; error?: string }> {
  const prisma = getRawPrisma();
  try {
    await prisma.$transaction(async (tx) => {
      const today = new Date().toISOString().slice(0, 10);
      const active = await tx.reservation.findFirst({
        where: {
          tableId,
          status: "confirmed",
          startsAt: {
            gte: new Date(today + "T00:00:00Z"),
            lte: new Date(today + "T23:59:59.999Z"),
          },
        },
      });
      if (!active) throw new Error("No active reservation");
      if (active.reservationPin !== pin) throw new Error("Invalid PIN");

      await tx.reservation.update({
        where: { id: active.id },
        data: { status: "seated", reservationPin: null },
      });

      await tx.venueTable.update({
        where: { id: tableId },
        data: { status: "occupied" },
      });
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ── Capacity check ────────────────────────────────────────────────

export async function checkCapacityForBooking(
  db: ScopedDb,
  date: string,
  partySize: number,
): Promise<{ allowed: boolean; currentBooked: number; legalCapacity: number }> {
  const venue = await db.venue.findFirst();
  if (!venue) throw new Error("Venue not found");

  const booked = await db.reservation.aggregate({
    where: {
      status: { in: ["confirmed", "seated"] },
      startsAt: {
        gte: new Date(date + "T00:00:00Z"),
        lte: new Date(date + "T23:59:59.999Z"),
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _sum: { partySize: true } as any,
  });

  const currentBooked = (booked as unknown as { _sum: { partySize: number | null } })._sum.partySize ?? 0;
  return {
    allowed: currentBooked + partySize <= venue.legalCapacity,
    currentBooked,
    legalCapacity: venue.legalCapacity,
  };
}
