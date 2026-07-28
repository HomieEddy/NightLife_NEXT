/**
 * mockDoorService — future backend boundary for the door: occupancy,
 * admissions and coat check (plan 17). Occupancy is a counter, never derived
 * from table state — most of the room isn't at a table.
 */
import type { Admission, AdmissionType, CoatCheckTicket, OccupancyEvent } from "@/lib/types";
import { mockAdmissions, mockCoatCheckTickets, mockOccupancyEvents } from "@/features/door/mock-data";
import { mockVenue } from "@/features/venue/mock-data";
import { businessDateFor, canApplyOccupancyDelta, canAdmitWithinCapacity, checkAgeOnAdmission, computeOccupancy } from "@/lib/door";
import { clone, delay, uid } from "@/features/shared/delay";
import { mockAuditService } from "@/features/platform/audit-mock-service";
import { mockGuestService } from "@/features/sessions/mock-service";
import { mockVenueService } from "@/features/venue/mock-service";

let occupancyEvents: OccupancyEvent[] = clone(mockOccupancyEvents);
let admissions: Admission[] = clone(mockAdmissions);
let coatCheckTickets: CoatCheckTicket[] = clone(mockCoatCheckTickets);
let coatCheckCounter = 103;

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
    return { ok: true, current: current + delta };
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
};
