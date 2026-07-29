/**
 * mockDoorService — future backend boundary for the door: occupancy,
 * admissions and coat check (plan 17). Occupancy is a counter, never derived
 * from table state — most of the room isn't at a table.
 */
import type { Admission, AdmissionType, CoatCheckClaim, CoatCheckTicket, DoorRefusal, OccupancyEvent } from "@/lib/types";
import { mockAdmissions, mockCoatCheckTickets, mockOccupancyEvents } from "@/features/door/mock-data";
import { mockVenue } from "@/features/venue/mock-data";
import { businessDateFor, canAdmitToZone, canApplyOccupancyDelta, canAdmitWithinCapacity, checkAgeOnAdmission, computeOccupancy } from "@/lib/door";
import { clone, delay, uid } from "@/features/shared/delay";
import { mockAuditService } from "@/features/platform/audit-mock-service";
import { mockGuestService } from "@/features/sessions/mock-service";
import { mockGuestsService } from "@/features/guests/mock-service";
import { mockVenueService } from "@/features/venue/mock-service";
import { mockNotificationService } from "@/features/shared/notification-mock-service";

let occupancyEvents: OccupancyEvent[] = clone(mockOccupancyEvents);
let admissions: Admission[] = clone(mockAdmissions);
let coatCheckTickets: CoatCheckTicket[] = clone(mockCoatCheckTickets);
let coatCheckCounter = 103;
let doorRefusals: DoorRefusal[] = [];
/** NT-06: prevent repeated capacity-warning pushes — reset on page reload. */
let capacityWarnedForDate: string | null = null;
let coatCheckClaims: CoatCheckClaim[] = [];

// S-03: Evacuation state — starts normal, switched during an evacuation workflow
let evacuationState: "normal" | "evacuating" | "evacuated" = "normal";
let headcountAtEvacuation = 0;

async function currentBusinessDate(): Promise<string> {
  const venue = await mockVenueService.getVenueSnapshot();
  return businessDateFor(new Date().toISOString(), venue.nightEndHour);
}

export const mockDoorService = {
  async getOccupancy(businessDate?: string): Promise<{ current: number; legalCapacity: number; businessDate: string }> {
    await delay(150);
    const venue = await mockVenueService.getVenueSnapshot();
    const date = businessDate ?? (await currentBusinessDate());
    return { current: computeOccupancy(occupancyEvents, date), legalCapacity: venue.legalCapacity, businessDate: date };
  },

  async listOccupancyEvents(businessDate?: string): Promise<OccupancyEvent[]> {
    await delay(150);
    const date = businessDate ?? (await currentBusinessDate());
    return clone(occupancyEvents.filter((e) => e.businessDate === date)).sort((a, b) => b.at.localeCompare(a.at));
  },

  /** The +1/−1 thumb targets and any manual correction. Refuses a delta that would go negative (INV-D1). */
  async adjustOccupancy(delta: number, reason: string, staffId: string): Promise<{ ok: boolean; current: number; error?: string }> {
    await delay(150);
    const date = await currentBusinessDate();
    const current = computeOccupancy(occupancyEvents, date);
    if (!canApplyOccupancyDelta(current, delta)) {
      return { ok: false, current, error: "Occupancy can't go below zero" };
    }
    const event: OccupancyEvent = {
      id: uid("oe"),
      venueId: mockVenue.id,
      businessDate: date,
      delta,
      reason,
      staffId,
      at: new Date().toISOString(),
    };
    occupancyEvents = [event, ...occupancyEvents];
    const newCurrent = current + delta;
    // NT-06: capacity warning at 90% — dispatch once per business date
    const venue = await mockVenueService.getVenue();
    const warnRatio = venue.occupancyWarnRatio ?? 0.9;
    const warnAt = Math.floor(venue.legalCapacity * warnRatio);
    if (newCurrent >= warnAt && capacityWarnedForDate !== date) {
      capacityWarnedForDate = date;
      mockNotificationService.dispatchPush(
        "capacity-warning",
        `Occupancy at ${Math.round((newCurrent / venue.legalCapacity) * 100)}%`,
        `${newCurrent}/${venue.legalCapacity} guests in the venue — consider slowing admissions.`,
        ["security"],
      );
    }
    return { ok: true, current: newCurrent };
  },

  async listAdmissions(businessDate?: string): Promise<Admission[]> {
    await delay();
    const date = businessDate ?? (await currentBusinessDate());
    return clone(admissions.filter((a) => a.businessDate === date)).sort((a, b) => b.admittedAt.localeCompare(a.admittedAt));
  },

  async getAdmission(id: string): Promise<Admission | null> {
    await delay(150);
    return clone(admissions.find((a) => a.id === id) ?? null);
  },

  /** One flow, three sources — walk-in/reservation/guestlist all funnel here. Occupancy moves in the same call. */
  async admit(input: {
    guestProfileId?: string;
    partySize: number;
    admissionType: AdmissionType;
    amountOwedCents: number;
    source: Admission["source"];
    reservationId?: string;
    eventGuestId?: string;
    idCheck?: { checked: boolean; dobVerified: boolean; yearOfBirth?: number };
    staffId: string;
    staffName: string;
    wristbandColor?: string;
  }): Promise<Admission> {
    await delay(400);

    // S-03: block admission while evacuating
    if (evacuationState !== "normal") {
      throw new Error("Admissions are disabled during an emergency evacuation.");
    }

    // Shared venue snapshot for S-01 + S-13 checks
    const venueSnapshot = await mockVenueService.getVenueSnapshot();

    // S-01: age verification — block underage admission (hard legal boundary, no override)
    let yearOfBirth: number | undefined;
    if (input.idCheck?.yearOfBirth !== undefined) {
      yearOfBirth = input.idCheck.yearOfBirth;
    } else if (input.guestProfileId) {
      const profile = await mockGuestService.getProfile(input.guestProfileId);
      if (profile?.dobYear !== undefined) yearOfBirth = profile.dobYear;
    }
    if (yearOfBirth !== undefined) {
      const denial = checkAgeOnAdmission(yearOfBirth, venueSnapshot.legalDrinkingAge, undefined);
      if (denial === "underage") {
        throw new Error(
          `Guest is under the legal drinking age of ${venueSnapshot.legalDrinkingAge}. Admission blocked — this cannot be overridden.`,
        );
      }
    }

    // S-13: legal capacity enforcement — refuse when at/over capacity
    const date = await currentBusinessDate();
    const current = computeOccupancy(occupancyEvents, date);
    if (!canAdmitWithinCapacity(current, input.partySize, venueSnapshot.legalCapacity)) {
      throw new Error(
        `At legal capacity (${venueSnapshot.legalCapacity}). Only a manager with capacity-override can admit further.`,
      );
    }

    const now = new Date().toISOString();
    const admission: Admission = {
      id: uid("adm"),
      venueId: mockVenue.id,
      businessDate: date,
      guestProfileId: input.guestProfileId,
      partySize: input.partySize,
      admissionType: input.admissionType,
      amountOwedCents: input.amountOwedCents,
      source: input.source,
      reservationId: input.reservationId,
      eventGuestId: input.eventGuestId,
      idCheck: input.idCheck ? { checked: input.idCheck.checked, dobVerified: input.idCheck.dobVerified, yearOfBirth, byStaffId: input.staffId, at: now } : undefined,
      admittedByStaffId: input.staffId,
      admittedByStaffName: input.staffName,
      admittedAt: now,
      wristband: input.wristbandColor ? { number: `WB-${Date.now().toString(36).slice(-4).toUpperCase()}`, color: input.wristbandColor, assignedAt: now } : undefined,
    };
    admissions = [admission, ...admissions];
    await mockDoorService.adjustOccupancy(input.partySize, `${input.source} admit`, input.staffId);
    return clone(admission);
  },

  /** Re-entry reuses the original admission's cover — occupancy moves by partySize again without double-billing. */
  async reEnter(admissionId: string, staffId: string, staffName: string): Promise<Admission | null> {
    await delay(400);
    const original = admissions.find((a) => a.id === admissionId);
    if (!original) return null;
    const date = await currentBusinessDate();
    const now = new Date().toISOString();
    const admission: Admission = {
      ...clone(original),
      id: uid("adm"),
      businessDate: date,
      amountOwedCents: 0, // already paid on the original admission — not billed again
      source: "re-entry",
      admittedByStaffId: staffId,
      admittedByStaffName: staffName,
      admittedAt: now,
      exitedAt: undefined,
      reEntryOfAdmissionId: original.id,
    };
    admissions = [admission, ...admissions];
    await mockDoorService.adjustOccupancy(admission.partySize, "re-entry", staffId);
    return clone(admission);
  },

  async recordExit(admissionId: string, staffId: string): Promise<Admission | null> {
    await delay(300);
    const admission = admissions.find((a) => a.id === admissionId && !a.exitedAt);
    if (!admission) return null;
    admission.exitedAt = new Date().toISOString();
    await mockDoorService.adjustOccupancy(-admission.partySize, "exit", staffId);
    return clone(admission);
  },

  /** The ban-override path — requires door:admit-banned-override (manager only) and always audits (INV-D3). */
  async admitBannedOverride(input: {
    guestProfileId: string;
    partySize: number;
    reason: string;
    staffId: string;
    staffName: string;
  }): Promise<Admission> {
    const admission = await mockDoorService.admit({
      guestProfileId: input.guestProfileId,
      partySize: input.partySize,
      admissionType: "cover",
      amountOwedCents: 0,
      source: "walk-in",
      staffId: input.staffId,
      staffName: input.staffName,
    });
    await mockAuditService.record({
      actorStaffId: input.staffId,
      actorName: input.staffName,
      action: "door:admit-banned-override",
      targetType: "guest-profile",
      targetId: input.guestProfileId,
      summary: `Overrode a ban to admit a guest — ${input.reason}`,
      metadata: { admissionId: admission.id },
    });
    return admission;
  },

  // ---------- DO-06: Per-zone occupancy — derived from active sessions on tables in zone ----------

  /** Occupancy for a single zone: sum of partySize from active sessions on tables in that zone. */
  async getZoneOccupancy(zoneId: string): Promise<{ zoneId: string; current: number; capacity: number | null }> {
    await delay(150);
    const [tables, sessions, zones] = await Promise.all([
      mockVenueService.listTables(zoneId),
      mockGuestsService.listSessions(),
      mockVenueService.listZones(),
    ]);
    const tableIds = new Set(tables.map((t) => t.id));
    const activeStatuses = new Set(["approved", "closure-requested"]);
    const current = sessions
      .filter((s) => activeStatuses.has(s.status) && tableIds.has(s.tableId))
      .reduce((sum, s) => sum + s.partySize, 0);
    const zone = zones.find((z) => z.id === zoneId);
    return { zoneId, current, capacity: zone?.capacity ?? null };
  },

  /** Occupancy breakdown for every zone — one call for the manager dashboard. */
  async getOccupancyByZone(): Promise<{ zoneId: string; zoneName: string; current: number; capacity: number | null }[]> {
    await delay(200);
    const [zones, allTables, sessions] = await Promise.all([
      mockVenueService.listZones(),
      mockVenueService.listTables(),
      mockGuestsService.listSessions(),
    ]);
    const activeStatuses = new Set(["approved", "closure-requested"]);
    const activeSessions = sessions.filter((s) => activeStatuses.has(s.status));
    return zones.map((zone) => {
      const tableIds = new Set(allTables.filter((t) => t.zoneId === zone.id).map((t) => t.id));
      const current = activeSessions
        .filter((s) => tableIds.has(s.tableId))
        .reduce((sum, s) => sum + s.partySize, 0);
      return { zoneId: zone.id, zoneName: zone.name, current, capacity: zone.capacity };
    });
  },

  /** VM-02: Check if a zone can accept a party of the given size. */
  async checkZoneCapacity(zoneId: string, partySize: number): Promise<{ allowed: boolean; current: number; capacity: number | null }> {
    await delay(100);
    const { current, capacity } = await mockDoorService.getZoneOccupancy(zoneId);
    return { allowed: canAdmitToZone(current, partySize, capacity), current, capacity };
  },

  // ---------- Coat check — gated behind venue.coatCheckEnabled by the caller ----------

  async listCoatCheckTickets(businessDate?: string): Promise<CoatCheckTicket[]> {
    await delay();
    const date = businessDate ?? (await currentBusinessDate());
    return clone(coatCheckTickets.filter((t) => t.businessDate === date)).sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt));
  },

  async checkInCoat(input: { itemCount: number; guestProfileId?: string; staffId: string }): Promise<CoatCheckTicket> {
    await delay(300);
    const date = await currentBusinessDate();
    const ticket: CoatCheckTicket = {
      id: uid("cc"),
      venueId: mockVenue.id,
      businessDate: date,
      ticketNumber: coatCheckCounter++,
      guestProfileId: input.guestProfileId,
      itemCount: input.itemCount,
      checkedInAt: new Date().toISOString(),
      staffId: input.staffId,
    };
    coatCheckTickets = [ticket, ...coatCheckTickets];
    return clone(ticket);
  },

  async claimCoat(ticketId: string): Promise<CoatCheckTicket | null> {
    await delay(250);
    const ticket = coatCheckTickets.find((t) => t.id === ticketId && !t.claimedAt);
    if (!ticket) return null;
    ticket.claimedAt = new Date().toISOString();
    return clone(ticket);
  },

  // ---------- S-03: Emergency evacuation ----------

  async getEvacuationState(): Promise<{ state: string; headcountAtEvacuation: number }> {
    await delay(100);
    return { state: evacuationState, headcountAtEvacuation };
  },

  /** One-action evacuate: zero occupancy delta, sets evacuation flag, audits, returns headcount. */
  async evacuate(staffId: string, staffName: string): Promise<{ headcount: number }> {
    await delay(400);
    if (evacuationState !== "normal") throw new Error("Already evacuating.");
    const date = await currentBusinessDate();
    const current = computeOccupancy(occupancyEvents, date);
    headcountAtEvacuation = current;
    const event: OccupancyEvent = {
      id: uid("oe"),
      venueId: mockVenue.id,
      businessDate: date,
      delta: -current,
      reason: "emergency-evacuation",
      staffId,
      at: new Date().toISOString(),
    };
    occupancyEvents = [event, ...occupancyEvents];
    evacuationState = "evacuated";
    await mockAuditService.record({
      actorStaffId: staffId,
      actorName: staffName,
      action: "emergency:evacuate",
      targetType: "occupancy",
      targetId: event.id,
      summary: `Emergency evacuation — occupancy zeroed from ${current} to 0`,
      metadata: { headcountAtEvacuation: current },
    });
    return { headcount: current };
  },

  /** Resume normal operations after an evacuation — manager only. Restores the headcount. */
  async resumeEvacuation(staffId: string, staffName: string): Promise<void> {
    await delay(400);
    if (evacuationState !== "evacuated") throw new Error("No active evacuation to resume from.");
    const date = await currentBusinessDate();
    const event: OccupancyEvent = {
      id: uid("oe"),
      venueId: mockVenue.id,
      businessDate: date,
      delta: headcountAtEvacuation,
      reason: "emergency-resume",
      staffId,
      at: new Date().toISOString(),
    };
    occupancyEvents = [event, ...occupancyEvents];
    evacuationState = "normal";
    headcountAtEvacuation = 0;
    await mockAuditService.record({
      actorStaffId: staffId,
      actorName: staffName,
      action: "emergency:resume",
      targetType: "occupancy",
      targetId: event.id,
      summary: `Emergency evacuation ended — operations resumed at headcount ${headcountAtEvacuation}`,
    });
  },

  // ---------- DO-02: Dress code refusal tracking ----------

  /** DO-02: Record a dress-code refusal at the door. */
  async recordRefusal(input: { reason: string; description: string; partySize: number; staffId: string; staffName: string }): Promise<DoorRefusal> {
    await delay(200);
    const date = await currentBusinessDate();
    const refusal: DoorRefusal = {
      id: uid("dr"),
      venueId: mockVenue.id,
      businessDate: date,
      reason: input.reason,
      description: input.description,
      partySize: input.partySize,
      refusedByStaffId: input.staffId,
      refusedByStaffName: input.staffName,
      timestamp: new Date().toISOString(),
    };
    doorRefusals = [...doorRefusals, refusal];
    return clone(refusal);
  },

  async listRefusals(businessDate?: string): Promise<DoorRefusal[]> {
    await delay(150);
    const date = businessDate ?? (await currentBusinessDate());
    return clone(doorRefusals.filter((r) => r.businessDate === date)).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  },

  // ---------- DO-10: Coat check lost item ----------

  /** DO-10: Report a lost coat check ticket. */
  async reportLostTicket(description: string, staffName: string): Promise<CoatCheckClaim> {
    await delay(200);
    const claim: CoatCheckClaim = {
      id: uid("ccl"),
      claimType: "lost-ticket",
      description,
      reportedByStaffName: staffName,
      reportedAt: new Date().toISOString(),
    };
    coatCheckClaims = [...coatCheckClaims, claim];
    return clone(claim);
  },

  async reportLostItem(ticketId: string, description: string, staffName: string): Promise<CoatCheckClaim> {
    await delay(200);
    const claim: CoatCheckClaim = {
      id: uid("ccl"),
      ticketId,
      claimType: "lost-item",
      description,
      reportedByStaffName: staffName,
      reportedAt: new Date().toISOString(),
    };
    coatCheckClaims = [...coatCheckClaims, claim];
    return clone(claim);
  },

  async resolveClaim(claimId: string, resolution: string, staffId: string): Promise<CoatCheckClaim | null> {
    await delay(200);
    const claim = coatCheckClaims.find((c) => c.id === claimId && !c.resolvedAt);
    if (!claim) return null;
    claim.resolution = resolution;
    claim.resolvedAt = new Date().toISOString();
    claim.resolvedByStaffId = staffId;
    return clone(claim);
  },

  // ---------- S-13: Capacity-override admission ----------

  /** Manager-only bypass of the legal-capacity check — always writes an audit entry. */
  async admitCapacityOverride(input: {
    guestProfileId?: string;
    partySize: number;
    reason: string;
    staffId: string;
    staffName: string;
  }): Promise<Admission> {
    const admission = await mockDoorService.admit({
      guestProfileId: input.guestProfileId,
      partySize: input.partySize,
      admissionType: "cover",
      amountOwedCents: 0,
      source: "walk-in",
      staffId: input.staffId,
      staffName: input.staffName,
    });
    await mockAuditService.record({
      actorStaffId: input.staffId,
      actorName: input.staffName,
      action: "door:admit-capacity-override",
      targetType: "admission",
      targetId: admission.id,
      summary: `Capacity override — admitted party of ${input.partySize} past legal capacity: ${input.reason}`,
      metadata: { admissionId: admission.id },
    });
    return admission;
  },

  /** DO-08: Group admission — batch-admits a party under one group ID. */
  /** DO-08: Batch admit a group under one groupAdmissionId — each admission flows through admit() for validation. */
  async admitGroup(input: {
    members: { partySize: number; admissionType: AdmissionType; amountOwedCents: number; source: Admission["source"]; guestProfileId?: string }[];
    staffId: string;
    staffName: string;
    wristbandColor?: string;
  }): Promise<Admission[]> {
    const groupId = `grp-${uid("gadm")}`;
    const result: Admission[] = [];
    for (const m of input.members) {
      const adm = await mockDoorService.admit({
        guestProfileId: m.guestProfileId,
        partySize: m.partySize,
        admissionType: m.admissionType,
        amountOwedCents: m.amountOwedCents,
        source: m.source,
        staffId: input.staffId,
        staffName: input.staffName,
        wristbandColor: input.wristbandColor,
      });
      adm.groupAdmissionId = groupId;
      result.push(adm);
    }
    return result;
  },
};
