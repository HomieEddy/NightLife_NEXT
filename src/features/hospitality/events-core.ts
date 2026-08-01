/**
 * Events + guestlist lifecycle: CRUD for venue events, add/remove/check-in guests.
 * Event status is editorial (draft/published/live/ended/cancelled) — stored, not derived.
 */
import type { getDb } from "@/features/shared/db";
import type { VenueEvent, EventGuest, EventTalent, EventStatus, TalentRole, TalentStatus } from "@/lib/types";
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
  ticketUrl: string | null;
  cancellationReason: string | null;
  cancelledAt: Date | null;
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
    ticketUrl: row.ticketUrl ?? undefined,
    cancellationReason: row.cancellationReason ?? undefined,
    cancelledAt: row.cancelledAt?.toISOString(),
  };
}

function toGuest(row: {
  id: string;
  eventId: string;
  name: string;
  partySize: number;
  status: string;
  guestProfileId: string | null;
  promoterId: string | null;
}): EventGuest {
  return {
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    partySize: row.partySize,
    status: row.status as EventGuest["status"],
    guestProfileId: row.guestProfileId ?? undefined,
    promoterId: row.promoterId ?? undefined,
  };
}

function toTalent(row: {
  id: string;
  eventId: string;
  venueId: string;
  name: string;
  role: string;
  setTimes: unknown;
  arrivalTime: Date | null;
  rider: string | null;
  greenRoom: string | null;
  status: string;
  createdAt: Date;
}): EventTalent {
  return {
    id: row.id,
    eventId: row.eventId,
    venueId: row.venueId,
    name: row.name,
    role: row.role as TalentRole,
    setTimes: (Array.isArray(row.setTimes) ? row.setTimes : []) as EventTalent["setTimes"],
    arrivalTime: row.arrivalTime?.toISOString(),
    rider: row.rider ?? undefined,
    greenRoom: row.greenRoom ?? undefined,
    status: row.status as TalentStatus,
    createdAt: row.createdAt.toISOString(),
  };
}

const eventSelect = {
  id: true,
  venueId: true,
  name: true,
  description: true,
  startsAt: true,
  endsAt: true,
  zoneId: true,
  capacity: true,
  status: true,
  guestlistEnabled: true,
  ticketUrl: true,
  cancellationReason: true,
  cancelledAt: true,
} as const;

const guestSelect = {
  id: true,
  eventId: true,
  name: true,
  partySize: true,
  status: true,
  guestProfileId: true,
  promoterId: true,
} as const;

const talentSelect = {
  id: true,
  eventId: true,
  venueId: true,
  name: true,
  role: true,
  setTimes: true,
  arrivalTime: true,
  rider: true,
  greenRoom: true,
  status: true,
  createdAt: true,
} as const;

export async function listEvents(db: ScopedDb): Promise<VenueEvent[]> {
  const rows = await db.venueEvent.findMany({
    select: eventSelect,
    orderBy: { startsAt: "asc" },
  });
  return rows.map(toEvent);
}

export async function getEvent(
  db: ScopedDb,
  id: string,
): Promise<VenueEvent | null> {
  const row = await db.venueEvent.findUnique({ where: { id }, select: eventSelect });
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
    select: eventSelect,
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
  if (patch.ticketUrl !== undefined) data.ticketUrl = patch.ticketUrl ?? null;

  const row = await db.venueEvent.update({ where: { id }, data, select: eventSelect }).catch(() => null);
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
    select: guestSelect,
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
      guestProfileId: input.guestProfileId ?? null,
      promoterId: input.promoterId ?? null,
    },
    select: guestSelect,
  });
  return toGuest(row);
}

export async function removeEventGuest(
  db: ScopedDb,
  guestId: string,
): Promise<void> {
  await db.eventGuest.delete({ where: { id: guestId } }).catch(() => undefined);
}

export async function setEventGuestStatus(
  db: ScopedDb,
  guestId: string,
  status: EventGuest["status"],
): Promise<EventGuest | null> {
  const row = await db.eventGuest.update({
    where: { id: guestId },
    data: { status },
    select: guestSelect,
  }).catch(() => null);
  return row ? toGuest(row) : null;
}

// ── Event cancellation ───────────────────────────────────────────────

export async function cancelEvent(
  db: ScopedDb,
  id: string,
  reason: string,
): Promise<VenueEvent | null> {
  const row = await db.venueEvent.update({
    where: { id },
    data: {
      status: "cancelled",
      cancellationReason: reason.trim(),
      cancelledAt: new Date(),
    },
    select: eventSelect,
  }).catch(() => null);
  return row ? toEvent(row) : null;
}

// ── Talent ───────────────────────────────────────────────────────────

export async function listEventTalent(
  db: ScopedDb,
  eventId: string,
): Promise<EventTalent[]> {
  const rows = await db.eventTalent.findMany({
    where: { eventId },
    select: talentSelect,
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toTalent);
}

export async function getTalent(
  db: ScopedDb,
  id: string,
): Promise<EventTalent | null> {
  const row = await db.eventTalent.findUnique({ where: { id }, select: talentSelect });
  return row ? toTalent(row) : null;
}

export async function createTalent(
  db: ScopedDb,
  venueId: string,
  input: Omit<EventTalent, "id" | "venueId" | "createdAt">,
): Promise<EventTalent> {
  const row = await db.eventTalent.create({
    data: {
      eventId: input.eventId,
      venueId,
      name: input.name,
      role: input.role,
      setTimes: input.setTimes,
      arrivalTime: input.arrivalTime ? new Date(input.arrivalTime) : null,
      rider: input.rider ?? null,
      greenRoom: input.greenRoom ?? null,
      status: input.status,
    },
    select: talentSelect,
  });
  return toTalent(row);
}

export async function updateTalent(
  db: ScopedDb,
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patch: Record<string, any>,
): Promise<EventTalent | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (patch.name !== undefined && patch.name !== null) data.name = patch.name;
  if (patch.role !== undefined && patch.role !== null) data.role = patch.role;
  if (patch.setTimes !== undefined && patch.setTimes !== null) data.setTimes = patch.setTimes;
  if (patch.arrivalTime !== undefined) data.arrivalTime = patch.arrivalTime ? new Date(patch.arrivalTime) : null;
  if (patch.rider !== undefined) data.rider = patch.rider ?? null;
  if (patch.greenRoom !== undefined) data.greenRoom = patch.greenRoom ?? null;
  if (patch.status !== undefined && patch.status !== null) data.status = patch.status;

  const row = await db.eventTalent.update({ where: { id }, data, select: talentSelect }).catch(() => null);
  return row ? toTalent(row) : null;
}

export async function deleteTalent(
  db: ScopedDb,
  id: string,
): Promise<void> {
  await db.eventTalent.delete({ where: { id } }).catch(() => undefined);
}

export async function setTalentStatus(
  db: ScopedDb,
  id: string,
  status: TalentStatus,
): Promise<EventTalent | null> {
  return updateTalent(db, id, { status });
}

// ── Promoter quota ───────────────────────────────────────────────────

export async function getQuotaUsage(
  db: ScopedDb,
  promoterId: string,
  eventId: string,
): Promise<{ quota: number | null; used: number; remaining: number | null }> {
  const promoter = await db.staffProfile.findUnique({
    where: { id: promoterId },
    select: { guestlistQuota: true },
  });
  const quota = promoter?.guestlistQuota ?? null;
  const guests = await db.eventGuest.findMany({
    where: { eventId, promoterId },
    select: { partySize: true },
  });
  const used = guests.reduce((sum, g) => sum + g.partySize, 0);
  const remaining = quota !== null ? Math.max(0, quota - used) : null;
  return { quota, used, remaining };
}

// ── Public events ────────────────────────────────────────────────────

export async function listPublicEvents(
  db: ScopedDb,
  venueSlug: string,
): Promise<{ venueName: string; events: VenueEvent[] } | null> {
  const venue = await db.venue.findFirst({ where: { publicSlug: venueSlug } });
  if (!venue) return null;

  // Venue name lives on Organization (1:1 via venue.id)
  const { getRawPrisma } = await import("@/features/shared/db");
  const prisma = getRawPrisma();
  const org = await prisma.organization.findUnique({ where: { id: venue.id }, select: { name: true } });

  const rows = await db.venueEvent.findMany({
    where: {
      venueId: venue.id,
      status: { in: ["published", "live"] },
      startsAt: { gte: new Date() },
    },
    select: eventSelect,
    orderBy: { startsAt: "asc" },
  });

  return { venueName: org?.name ?? venue.id, events: rows.map(toEvent) };
}
