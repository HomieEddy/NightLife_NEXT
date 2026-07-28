/**
 * Events + guestlist lifecycle: CRUD for venue events, add/remove/check-in guests.
 * Event status is editorial (draft/published/live/ended) — stored, not derived.
 */
import type { getDb } from "@/features/shared/db";
import type { VenueEvent, EventGuest, EventStatus } from "@/lib/types";
import type { z } from "zod";
import type { zEventInput, zEventPatch, zEventGuestInput } from "@/features/hospitality/events-schemas";

type ScopedDb = ReturnType<typeof getDb>;

function toEvent(row: {
  id: string;
  venueId: string;
  name: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  zoneId: string | null;
  capacity: number;
  status: string;
  guestlistEnabled: boolean;
}): VenueEvent {
  return {
    id: row.id,
    venueId: row.venueId,
    name: row.name,
    description: row.description,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    zoneId: row.zoneId ?? undefined,
    capacity: row.capacity,
    status: row.status as EventStatus,
    guestlistEnabled: row.guestlistEnabled,
  };
}

function toGuest(row: {
  id: string;
  eventId: string;
  name: string;
  partySize: number;
  status: string;
}): EventGuest {
  return {
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    partySize: row.partySize,
    status: row.status as EventGuest["status"],
  };
}

export async function listEvents(db: ScopedDb): Promise<VenueEvent[]> {
  const rows = await db.venueEvent.findMany({ orderBy: { startsAt: "asc" } });
  return rows.map(toEvent);
}

export async function getEvent(
  db: ScopedDb,
  id: string,
): Promise<VenueEvent | null> {
  const row = await db.venueEvent.findUnique({ where: { id } });
  return row ? toEvent(row) : null;
}

export async function createEvent(
  db: ScopedDb,
  venueId: string,
  input: z.infer<typeof zEventInput>,
): Promise<VenueEvent> {
  const row = await db.venueEvent.create({
    data: {
      venueId,
      name: input.name.trim(),
      description: input.description,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      zoneId: input.zoneId ?? null,
      capacity: input.capacity,
      status: input.status,
      guestlistEnabled: input.guestlistEnabled,
    },
  });
  return toEvent(row);
}

export async function updateEvent(
  db: ScopedDb,
  id: string,
  patch: z.infer<typeof zEventPatch>,
): Promise<VenueEvent | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (patch.name !== undefined) data.name = patch.name.trim();
  if (patch.description !== undefined) data.description = patch.description;
  if (patch.startsAt !== undefined) data.startsAt = new Date(patch.startsAt);
  if (patch.endsAt !== undefined) data.endsAt = new Date(patch.endsAt);
  if (patch.zoneId !== undefined) data.zoneId = patch.zoneId ?? null;
  if (patch.capacity !== undefined) data.capacity = patch.capacity;
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.guestlistEnabled !== undefined) data.guestlistEnabled = patch.guestlistEnabled;

  const row = await db.venueEvent.update({ where: { id }, data }).catch(() => null);
  return row ? toEvent(row) : null;
}

export async function deleteEvent(
  db: ScopedDb,
  id: string,
): Promise<void> {
  await db.venueEvent.delete({ where: { id } }).catch(() => undefined);
}

// ── Guestlist ────────────────────────────────────────────────────────

export async function listEventGuests(
  db: ScopedDb,
  eventId: string,
): Promise<EventGuest[]> {
  const rows = await db.eventGuest.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toGuest);
}

export async function addEventGuest(
  db: ScopedDb,
  input: z.infer<typeof zEventGuestInput>,
): Promise<EventGuest> {
  const row = await db.eventGuest.create({
    data: {
      eventId: input.eventId,
      name: input.name.trim(),
      partySize: input.partySize,
      status: "invited",
    },
  });
  return toGuest(row);
}

export async function removeEventGuest(
  db: ScopedDb,
  guestId: string,
): Promise<void> {
  await db.eventGuest.delete({ where: { id: guestId } }).catch(() => undefined);
}
