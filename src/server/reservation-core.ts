/**
 * Reservation lifecycle: CRUD + status transitions + table-status integration.
 * confirm → table "reserved"; seat → "occupied"; cancel/complete → release.
 * The table-flip happens in the same transaction as the status write.
 */
import type { getDb } from "./db";
import { getRawPrisma } from "@/server/db";
import type { Reservation, ReservationStatus } from "@/lib/types";
import type { z } from "zod";
import type { zReservationInput, zReservationPatch, zListReservations } from "./schemas/reservations";

type ScopedDb = ReturnType<typeof getDb>;

function toReservation(row: {
  id: string;
  venueId: string;
  tableId: string | null;
  zoneId: string | null;
  guestName: string;
  partySize: number;
  startsAt: Date;
  endsAt: Date | null;
  status: string;
  note: string | null;
  source: string;
  createdAt: Date;
}): Reservation {
  return {
    id: row.id,
    venueId: row.venueId,
    tableId: row.tableId ?? undefined,
    zoneId: row.zoneId ?? undefined,
    guestName: row.guestName,
    partySize: row.partySize,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt?.toISOString(),
    status: row.status as ReservationStatus,
    note: row.note ?? undefined,
    source: row.source as Reservation["source"],
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listReservations(
  db: ScopedDb,
  filter?: z.infer<typeof zListReservations>,
): Promise<Reservation[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (filter?.status?.length) where.status = { in: filter.status };
  if (filter?.zoneIds?.length) where.zoneId = { in: filter.zoneIds };
  if (filter?.date) {
    const start = new Date(filter.date + "T00:00:00Z");
    const end = new Date(filter.date + "T23:59:59.999Z");
    where.startsAt = { gte: start, lte: end };
  }

  const rows = await db.reservation.findMany({
    where,
    orderBy: { startsAt: "asc" },
  });
  return rows.map(toReservation);
}

export async function getReservation(
  db: ScopedDb,
  id: string,
): Promise<Reservation | null> {
  const row = await db.reservation.findUnique({ where: { id } });
  return row ? toReservation(row) : null;
}

export async function createReservation(
  db: ScopedDb,
  venueId: string,
  input: z.infer<typeof zReservationInput>,
): Promise<Reservation> {
  const row = await db.reservation.create({
    data: {
      venueId,
      tableId: input.tableId ?? null,
      zoneId: input.zoneId ?? null,
      guestName: input.guestName.trim(),
      partySize: input.partySize,
      startsAt: new Date(input.startsAt),
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      status: "requested",
      note: input.note?.trim() || null,
      source: input.source,
    },
  });
  return toReservation(row);
}

export async function updateReservation(
  db: ScopedDb,
  id: string,
  patch: z.infer<typeof zReservationPatch>,
): Promise<Reservation | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (patch.guestName !== undefined) data.guestName = patch.guestName.trim();
  if (patch.partySize !== undefined) data.partySize = patch.partySize;
  if (patch.startsAt !== undefined) data.startsAt = new Date(patch.startsAt);
  if (patch.endsAt !== undefined) data.endsAt = patch.endsAt ? new Date(patch.endsAt) : null;
  if (patch.note !== undefined) data.note = patch.note?.trim() || null;
  if (patch.tableId !== undefined) data.tableId = patch.tableId;
  if (patch.zoneId !== undefined) data.zoneId = patch.zoneId;

  const row = await db.reservation.update({ where: { id }, data }).catch(() => null);
  return row ? toReservation(row) : null;
}

// Table status that a reservation status implies
function tableStatusFor(status: ReservationStatus): "reserved" | "occupied" | "open" | null {
  if (status === "confirmed" || status === "requested") return "reserved";
  if (status === "seated") return "occupied";
  if (status === "cancelled" || status === "completed") return "open";
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

      const updated = await tx.reservation.update({
        where: { id },
        data: { status },
      });

      // Flip table status in the same transaction
      const targetTableStatus = tableStatusFor(status);
      if (updated.tableId && targetTableStatus) {
        // On cancel/complete, only release if this reservation still holds it
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
