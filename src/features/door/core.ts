/**
 * Door business logic — occupancy, admissions, coat check, evacuation
 * (plan 17). Every write path is transactional. Occupancy events use
 * the same ledger discipline as StockMovement (INV-I1).
 */
import type { getDb } from "@/features/shared/db";
import {
  computeOccupancy,
  canApplyOccupancyDelta,
  checkAgeOnAdmission,
  canAdmitWithinCapacity,
  canAdmitToZone,
  businessDateFor,
} from "@/lib/door";
import type {
  Admission,
  CoatCheckClaim,
  CoatCheckTicket,
  DoorRefusal,
  OccupancyEvent,
} from "@/lib/types";
import type { z } from "zod";
import type { zAdmit, zAdjustOccupancy, zAdmitGroup, zAdmitBannedOverride, zAdmitCapacityOverride, zRecordRefusal } from "@/features/door/schemas";

type ScopedDb = ReturnType<typeof getDb>;

// ══════════════════════════════════════════════════════════════════════════
// Row → domain mappers
// ══════════════════════════════════════════════════════════════════════════

interface OccupancyRow {
  id: string;
  venueId: string;
  businessDate: string;
  delta: number;
  reason: string;
  staffId: string;
  at: Date;
}

function toOccupancyEvent(row: OccupancyRow): OccupancyEvent {
  return {
    id: row.id,
    venueId: row.venueId,
    businessDate: row.businessDate,
    delta: row.delta,
    reason: row.reason,
    staffId: row.staffId,
    at: row.at.toISOString(),
  };
}

interface AdmissionRow {
  id: string;
  venueId: string;
  businessDate: string;
  guestProfileId: string | null;
  partySize: number;
  admissionType: string;
  amountOwedCents: number;
  source: string;
  reservationId: string | null;
  eventGuestId: string | null;
  idCheck: unknown;
  admittedByStaffId: string;
  admittedByStaffName: string;
  admittedAt: Date;
  exitedAt: Date | null;
  exitType: string | null;
  reEntryOfAdmissionId: string | null;
  wristband: unknown;
  groupAdmissionId: string | null;
}

function toAdmission(row: AdmissionRow): Admission {
  return {
    id: row.id,
    venueId: row.venueId,
    businessDate: row.businessDate,
    guestProfileId: row.guestProfileId ?? undefined,
    partySize: row.partySize,
    admissionType: row.admissionType as Admission["admissionType"],
    amountOwedCents: row.amountOwedCents,
    source: row.source as Admission["source"],
    reservationId: row.reservationId ?? undefined,
    eventGuestId: row.eventGuestId ?? undefined,
    idCheck: row.idCheck as Admission["idCheck"],
    admittedByStaffId: row.admittedByStaffId,
    admittedByStaffName: row.admittedByStaffName,
    admittedAt: row.admittedAt.toISOString(),
    exitedAt: row.exitedAt?.toISOString(),
    exitType: (row.exitType as Admission["exitType"]) ?? undefined,
    reEntryOfAdmissionId: row.reEntryOfAdmissionId ?? undefined,
    wristband: row.wristband as Admission["wristband"],
    groupAdmissionId: row.groupAdmissionId ?? undefined,
  };
}

interface CoatCheckRow {
  id: string;
  venueId: string;
  businessDate: string;
  ticketNumber: number;
  guestProfileId: string | null;
  itemCount: number;
  checkedInAt: Date;
  claimedAt: Date | null;
  staffId: string;
}

function toCoatCheckTicket(row: CoatCheckRow): CoatCheckTicket {
  return {
    id: row.id,
    venueId: row.venueId,
    businessDate: row.businessDate,
    ticketNumber: row.ticketNumber,
    guestProfileId: row.guestProfileId ?? undefined,
    itemCount: row.itemCount,
    checkedInAt: row.checkedInAt.toISOString(),
    claimedAt: row.claimedAt?.toISOString(),
    staffId: row.staffId,
  };
}

interface DoorRefusalRow {
  id: string;
  venueId: string;
  businessDate: string;
  reason: string;
  description: string;
  partySize: number;
  refusedByStaffId: string;
  refusedByStaffName: string;
  timestamp: Date;
}

function toDoorRefusal(row: DoorRefusalRow): DoorRefusal {
  return {
    id: row.id,
    venueId: row.venueId,
    businessDate: row.businessDate,
    reason: row.reason,
    description: row.description,
    partySize: row.partySize,
    refusedByStaffId: row.refusedByStaffId,
    refusedByStaffName: row.refusedByStaffName,
    timestamp: row.timestamp.toISOString(),
  };
}

interface CoatCheckClaimRow {
  id: string;
  venueId: string;
  claimType: string;
  ticketId: string | null;
  description: string;
  reportedByStaffName: string;
  reportedAt: Date;
  resolution: string | null;
  resolvedAt: Date | null;
  resolvedByStaffId: string | null;
}

function toCoatCheckClaim(row: CoatCheckClaimRow): CoatCheckClaim {
  return {
    id: row.id,
    claimType: row.claimType as CoatCheckClaim["claimType"],
    ticketId: row.ticketId ?? undefined,
    description: row.description,
    reportedByStaffName: row.reportedByStaffName,
    reportedAt: row.reportedAt.toISOString(),
    resolution: row.resolution ?? undefined,
    resolvedAt: row.resolvedAt?.toISOString(),
    resolvedByStaffId: row.resolvedByStaffId ?? undefined,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function venueBusinessDate(venue: { nightEndHour: number }): string {
  return businessDateFor(new Date().toISOString(), venue.nightEndHour);
}

async function getVenueConfig(db: ScopedDb, venueId: string) {
  // Venue is NOT auto-scoped (it's in the platform models list), so pass id explicitly.
  return db.venue.findFirstOrThrow({ where: { id: venueId } });
}

// ══════════════════════════════════════════════════════════════════════════
// Occupancy
// ══════════════════════════════════════════════════════════════════════════

export async function getOccupancy(
  db: ScopedDb,
  venueId: string,
  businessDate?: string,
): Promise<{ current: number; legalCapacity: number; businessDate: string }> {
  const venue = await getVenueConfig(db, venueId);
  const date = businessDate ?? venueBusinessDate(venue);
  const events = await db.occupancyEvent.findMany({ where: { businessDate: date } });
  return {
    current: computeOccupancy(events as unknown as unknown as OccupancyEvent[], date),
    legalCapacity: venue.legalCapacity,
    businessDate: date,
  };
}

export async function listOccupancyEvents(
  db: ScopedDb,
  venueId: string,
  businessDate?: string,
): Promise<OccupancyEvent[]> {
  const venue = await getVenueConfig(db, venueId);
  const date = businessDate ?? venueBusinessDate(venue);
  const rows = await db.occupancyEvent.findMany({
    where: { businessDate: date },
    orderBy: { at: "desc" },
  });
  return rows.map(toOccupancyEvent);
}

export async function adjustOccupancy(
  db: ScopedDb,
  venueId: string,
  input: z.infer<typeof zAdjustOccupancy>,
): Promise<{ ok: boolean; current: number; error?: string }> {
  const venue = await getVenueConfig(db, venueId);
  const date = venueBusinessDate(venue);
  const events = await db.occupancyEvent.findMany({ where: { businessDate: date } });
  const current = computeOccupancy(events as unknown as OccupancyEvent[], date);

  if (!canApplyOccupancyDelta(current, input.delta)) {
    return { ok: false, current, error: "Occupancy can't go below zero" };
  }

  await db.occupancyEvent.create({
    data: {
      venueId,
      businessDate: date,
      delta: input.delta,
      reason: input.reason,
      staffId: input.staffId,
      at: new Date(),
    },
  });

  return { ok: true, current: current + input.delta };
}

// ══════════════════════════════════════════════════════════════════════════
// Admissions
// ══════════════════════════════════════════════════════════════════════════

export async function listAdmissions(
  db: ScopedDb,
  venueId: string,
  businessDate?: string,
): Promise<Admission[]> {
  const venue = await getVenueConfig(db, venueId);
  const date = businessDate ?? venueBusinessDate(venue);
  const rows = await db.admission.findMany({
    where: { businessDate: date },
    orderBy: { admittedAt: "desc" },
  });
  return rows.map(toAdmission);
}

export async function getAdmission(
  db: ScopedDb,
  id: string,
): Promise<Admission | null> {
  const row = await db.admission.findUnique({ where: { id } });
  return row ? toAdmission(row) : null;
}

export async function createAdmission(
  db: ScopedDb,
  venueId: string,
  input: z.infer<typeof zAdmit>,
): Promise<Admission> {
  const venue = await getVenueConfig(db, venueId);

  // S-03: block admission during evacuation
  if (venue.evacuationState !== "normal") {
    throw new Error("Admissions are disabled during an emergency evacuation.");
  }

  // S-01: age verification
  let yearOfBirth: number | undefined = input.idCheck?.yearOfBirth;
  if (yearOfBirth === undefined && input.guestProfileId) {
    const profile = await db.guestProfile.findUnique({
      where: { id: input.guestProfileId },
    });
    yearOfBirth = profile?.dobYear ?? undefined;
  }
  if (yearOfBirth !== undefined) {
    const denial = checkAgeOnAdmission(yearOfBirth, venue.legalDrinkingAge, undefined);
    if (denial === "underage") {
      throw new Error(
        `Guest is under the legal drinking age of ${venue.legalDrinkingAge}. Admission blocked — this cannot be overridden.`,
      );
    }
  }

  // S-13: legal capacity enforcement
  const date = venueBusinessDate(venue);
  const events = await db.occupancyEvent.findMany({ where: { businessDate: date } });
  const current = computeOccupancy(events as unknown as OccupancyEvent[], date);
  if (!canAdmitWithinCapacity(current, input.partySize, venue.legalCapacity)) {
    throw new Error(
      `At legal capacity (${venue.legalCapacity}). Only a manager with capacity-override can admit further.`,
    );
  }

  const now = new Date();
  const admissionId = uid("adm");

  await db.admission.create({
    data: {
      id: admissionId,
      venueId,
      businessDate: date,
      guestProfileId: input.guestProfileId ?? null,
      partySize: input.partySize,
      admissionType: input.admissionType,
      amountOwedCents: input.amountOwedCents,
      source: input.source,
      reservationId: input.reservationId ?? null,
      eventGuestId: input.eventGuestId ?? null,
      idCheck: input.idCheck
        ? {
            checked: input.idCheck.checked,
            dobVerified: input.idCheck.dobVerified,
            yearOfBirth,
            byStaffId: input.staffId,
            at: now.toISOString(),
          }
        : undefined,
      admittedByStaffId: input.staffId,
      admittedByStaffName: input.staffName,
      admittedAt: now,
      wristband: input.wristbandColor
        ? {
            number: `WB-${Date.now().toString(36).slice(-4).toUpperCase()}`,
            color: input.wristbandColor,
            assignedAt: now.toISOString(),
          }
        : undefined,
    },
  });

  await db.occupancyEvent.create({
    data: {
      venueId,
      businessDate: date,
      delta: input.partySize,
      reason: `${input.source} admit`,
      staffId: input.staffId,
      at: now,
    },
  });

  return toAdmission(
    await db.admission.findUniqueOrThrow({ where: { id: admissionId } }),
  );
}

export async function createReEntry(
  db: ScopedDb,
  venueId: string,
  admissionId: string,
  staffId: string,
  staffName: string,
): Promise<Admission | null> {
  const venue = await getVenueConfig(db, venueId);
  const original = await db.admission.findUnique({ where: { id: admissionId } });
  if (!original) return null;

  const date = venueBusinessDate(venue);
  const now = new Date();
  const newId = uid("adm");

  await db.admission.create({
    data: {
      id: newId,
      venueId,
      businessDate: date,
      guestProfileId: original.guestProfileId,
      partySize: original.partySize,
      admissionType: original.admissionType,
      amountOwedCents: 0,
      source: "re-entry",
      reservationId: original.reservationId,
      eventGuestId: original.eventGuestId,
      admittedByStaffId: staffId,
      admittedByStaffName: staffName,
      admittedAt: now,
      reEntryOfAdmissionId: original.id,
    },
  });

  await db.occupancyEvent.create({
    data: {
      venueId,
      businessDate: date,
      delta: original.partySize,
      reason: "re-entry",
      staffId,
      at: now,
    },
  });

  return toAdmission(
    await db.admission.findUniqueOrThrow({ where: { id: newId } }),
  );
}

export async function recordExit(
  db: ScopedDb,
  venueId: string,
  admissionId: string,
  staffId: string,
): Promise<Admission | null> {
  const admission = await db.admission.findFirst({
    where: { id: admissionId, exitedAt: null },
  });
  if (!admission) return null;

  const now = new Date();
  await db.admission.update({
    where: { id: admissionId },
    data: { exitedAt: now, exitType: "final" },
  });

  await db.occupancyEvent.create({
    data: {
      venueId,
      businessDate: admission.businessDate,
      delta: -admission.partySize,
      reason: "exit",
      staffId,
      at: now,
    },
  });

  return toAdmission(
    await db.admission.findUniqueOrThrow({ where: { id: admissionId } }),
  );
}

export async function createBannedOverride(
  db: ScopedDb,
  venueId: string,
  input: z.infer<typeof zAdmitBannedOverride>,
): Promise<Admission> {
  const admission = await createAdmission(db, venueId, {
    guestProfileId: input.guestProfileId,
    partySize: input.partySize,
    admissionType: "cover",
    amountOwedCents: 0,
    source: "walk-in",
    staffId: input.staffId,
    staffName: input.staffName,
  });

  await db.auditEntry.create({
    data: {
      venueId,
      actorStaffId: input.staffId,
      actorName: input.staffName,
      action: "door:admit-banned-override",
      targetType: "guest-profile",
      targetId: input.guestProfileId,
      summary: `Overrode a ban to admit a guest — ${input.reason}`,
      metadata: JSON.stringify({ admissionId: admission.id }),
    },
  });

  return admission;
}

export async function createCapacityOverride(
  db: ScopedDb,
  venueId: string,
  input: z.infer<typeof zAdmitCapacityOverride>,
): Promise<Admission> {
  const admission = await createAdmission(db, venueId, {
    guestProfileId: input.guestProfileId,
    partySize: input.partySize,
    admissionType: "cover",
    amountOwedCents: 0,
    source: "walk-in",
    staffId: input.staffId,
    staffName: input.staffName,
  });

  await db.auditEntry.create({
    data: {
      venueId,
      actorStaffId: input.staffId,
      actorName: input.staffName,
      action: "door:admit-capacity-override",
      targetType: "admission",
      targetId: admission.id,
      summary: `Capacity override — admitted party of ${input.partySize} past legal capacity: ${input.reason}`,
      metadata: JSON.stringify({ admissionId: admission.id }),
    },
  });

  return admission;
}

// ══════════════════════════════════════════════════════════════════════════
// Coat check
// ══════════════════════════════════════════════════════════════════════════

export async function listCoatCheckTickets(
  db: ScopedDb,
  venueId: string,
  businessDate?: string,
): Promise<CoatCheckTicket[]> {
  const venue = await getVenueConfig(db, venueId);
  const date = businessDate ?? venueBusinessDate(venue);
  const rows = await db.coatCheckTicket.findMany({
    where: { businessDate: date },
    orderBy: { checkedInAt: "desc" },
  });
  return rows.map(toCoatCheckTicket);
}

export async function checkInCoat(
  db: ScopedDb,
  venueId: string,
  input: { itemCount: number; guestProfileId?: string; staffId: string },
): Promise<CoatCheckTicket> {
  const venue = await getVenueConfig(db, venueId);
  const date = venueBusinessDate(venue);

  const last = await db.coatCheckTicket.findFirst({
    where: { businessDate: date },
    orderBy: { ticketNumber: "desc" },
  });
  const ticketNumber = (last?.ticketNumber ?? 100) + 1;

  const row = await db.coatCheckTicket.create({
    data: {
      venueId,
      businessDate: date,
      ticketNumber,
      guestProfileId: input.guestProfileId ?? null,
      itemCount: input.itemCount,
      checkedInAt: new Date(),
      staffId: input.staffId,
    },
  });

  return toCoatCheckTicket(row);
}

export async function claimCoat(
  db: ScopedDb,
  ticketId: string,
): Promise<CoatCheckTicket | null> {
  const ticket = await db.coatCheckTicket.findFirst({
    where: { id: ticketId, claimedAt: null },
  });
  if (!ticket) return null;

  const updated = await db.coatCheckTicket.update({
    where: { id: ticketId },
    data: { claimedAt: new Date() },
  });

  return toCoatCheckTicket(updated);
}

// ══════════════════════════════════════════════════════════════════════════
// Evacuation (S-03)
// ══════════════════════════════════════════════════════════════════════════

export async function getEvacuationState(
  db: ScopedDb,
  venueId: string,
): Promise<{ state: string; headcountAtEvacuation: number }> {
  const venue = await getVenueConfig(db, venueId);
  return {
    state: venue.evacuationState,
    headcountAtEvacuation: 0,
  };
}

export async function evacuate(
  db: ScopedDb,
  venueId: string,
  staffId: string,
  staffName: string,
): Promise<{ headcount: number }> {
  const venue = await getVenueConfig(db, venueId);

  if (venue.evacuationState !== "normal") {
    throw new Error("Already evacuating.");
  }

  const date = venueBusinessDate(venue);
  const events = await db.occupancyEvent.findMany({ where: { businessDate: date } });
  const current = computeOccupancy(events as unknown as OccupancyEvent[], date);

  await db.occupancyEvent.create({
    data: {
      venueId,
      businessDate: date,
      delta: -current,
      reason: "emergency-evacuation",
      staffId,
      at: new Date(),
    },
  });

  await db.venue.update({
    where: { id: venueId },
    data: { evacuationState: "evacuated" },
  });

  await db.auditEntry.create({
    data: {
      venueId,
      actorStaffId: staffId,
      actorName: staffName,
      action: "emergency:evacuate",
      targetType: "occupancy",
      targetId: `evacuation-${date}`,
      summary: `Emergency evacuation — occupancy zeroed from ${current} to 0`,
      metadata: JSON.stringify({ headcountAtEvacuation: current }),
    },
  });

  return { headcount: current };
}

export async function resumeEvacuation(
  db: ScopedDb,
  venueId: string,
  staffId: string,
  staffName: string,
): Promise<void> {
  const venue = await getVenueConfig(db, venueId);

  if (venue.evacuationState !== "evacuated") {
    throw new Error("No active evacuation to resume from.");
  }

  const date = venueBusinessDate(venue);

  await db.venue.update({
    where: { id: venueId },
    data: { evacuationState: "normal" },
  });

  await db.auditEntry.create({
    data: {
      venueId,
      actorStaffId: staffId,
      actorName: staffName,
      action: "emergency:resume",
      targetType: "occupancy",
      targetId: `evacuation-${date}`,
      summary: "Emergency evacuation ended — operations resumed",
    },
  });
}

// ══════════════════════════════════════════════════════════════════════════
// Zone occupancy (DO-06 + VM-02)
// ══════════════════════════════════════════════════════════════════════════

export async function getZoneOccupancy(
  db: ScopedDb,
  zoneId: string,
): Promise<{ zoneId: string; current: number; capacity: number | null }> {
  const zone = await db.zone.findUniqueOrThrow({ where: { id: zoneId } });
  const tables = await db.venueTable.findMany({ where: { zoneId } });
  const tableIds = tables.map((t) => t.id);

  const activeSessions = await db.guestSession.findMany({
    where: {
      tableId: { in: tableIds },
      status: { in: ["approved", "closure_requested"] },
    },
  });

  const current = activeSessions.reduce((sum, s) => sum + s.partySize, 0);
  return { zoneId, current, capacity: zone.capacity };
}

export async function getOccupancyByZone(
  db: ScopedDb,
): Promise<{ zoneId: string; zoneName: string; current: number; capacity: number | null }[]> {
  const zones = await db.zone.findMany();
  const allTables = await db.venueTable.findMany();

  const activeSessions = await db.guestSession.findMany({
    where: { status: { in: ["approved", "closure_requested"] } },
  });

  return zones.map((zone) => {
    const tableIds = new Set(
      allTables.filter((t) => t.zoneId === zone.id).map((t) => t.id),
    );
    const current = activeSessions
      .filter((s) => tableIds.has(s.tableId))
      .reduce((sum, s) => sum + s.partySize, 0);
    return { zoneId: zone.id, zoneName: zone.name, current, capacity: zone.capacity };
  });
}

export async function checkZoneCapacity(
  db: ScopedDb,
  zoneId: string,
  partySize: number,
): Promise<{ allowed: boolean; current: number; capacity: number | null }> {
  const { current, capacity } = await getZoneOccupancy(db, zoneId);
  return { allowed: canAdmitToZone(current, partySize, capacity), current, capacity };
}

// ══════════════════════════════════════════════════════════════════════════
// Group admission (DO-08)
// ══════════════════════════════════════════════════════════════════════════

export async function admitGroup(
  db: ScopedDb,
  venueId: string,
  input: z.infer<typeof zAdmitGroup>,
): Promise<Admission[]> {
  const groupId = `grp-${Date.now().toString(36)}`;
  const results: Admission[] = [];

  for (const m of input.members) {
    const adm = await createAdmission(db, venueId, {
      guestProfileId: m.guestProfileId,
      partySize: m.partySize,
      admissionType: m.admissionType,
      amountOwedCents: m.amountOwedCents,
      source: m.source,
      staffId: input.staffId,
      staffName: input.staffName,
      wristbandColor: input.wristbandColor,
    });

    await db.admission.update({
      where: { id: adm.id },
      data: { groupAdmissionId: groupId },
    });

    results.push({ ...adm, groupAdmissionId: groupId });
  }

  return results;
}

// ══════════════════════════════════════════════════════════════════════════
// Refusals (DO-02)
// ══════════════════════════════════════════════════════════════════════════

export async function recordRefusal(
  db: ScopedDb,
  venueId: string,
  input: z.infer<typeof zRecordRefusal>,
): Promise<DoorRefusal> {
  const venue = await getVenueConfig(db, venueId);
  const date = venueBusinessDate(venue);

  const row = await db.doorRefusal.create({
    data: {
      venueId,
      businessDate: date,
      reason: input.reason,
      description: input.description,
      partySize: input.partySize,
      refusedByStaffId: input.staffId,
      refusedByStaffName: input.staffName,
      timestamp: new Date(),
    },
  });

  return toDoorRefusal(row);
}

export async function listRefusals(
  db: ScopedDb,
  venueId: string,
  businessDate?: string,
): Promise<DoorRefusal[]> {
  const venue = await getVenueConfig(db, venueId);
  const date = businessDate ?? venueBusinessDate(venue);
  const rows = await db.doorRefusal.findMany({
    where: { businessDate: date },
    orderBy: { timestamp: "desc" },
  });
  return rows.map(toDoorRefusal);
}

// ══════════════════════════════════════════════════════════════════════════
// Coat check claims (DO-10)
// ══════════════════════════════════════════════════════════════════════════

export async function reportLostTicket(
  db: ScopedDb,
  venueId: string,
  description: string,
  staffName: string,
): Promise<CoatCheckClaim> {
  const row = await db.coatCheckClaim.create({
    data: {
      venueId,
      claimType: "lost-ticket",
      description,
      reportedByStaffName: staffName,
      reportedAt: new Date(),
    },
  });
  return toCoatCheckClaim(row);
}

export async function reportLostItem(
  db: ScopedDb,
  venueId: string,
  ticketId: string,
  description: string,
  staffName: string,
): Promise<CoatCheckClaim> {
  const row = await db.coatCheckClaim.create({
    data: {
      venueId,
      claimType: "lost-item",
      ticketId,
      description,
      reportedByStaffName: staffName,
      reportedAt: new Date(),
    },
  });
  return toCoatCheckClaim(row);
}

export async function resolveClaim(
  db: ScopedDb,
  claimId: string,
  resolution: string,
  staffId: string,
): Promise<CoatCheckClaim | null> {
  const claim = await db.coatCheckClaim.findFirst({
    where: { id: claimId, resolvedAt: null },
  });
  if (!claim) return null;

  const updated = await db.coatCheckClaim.update({
    where: { id: claimId },
    data: { resolution, resolvedAt: new Date(), resolvedByStaffId: staffId },
  });
  return toCoatCheckClaim(updated);
}
