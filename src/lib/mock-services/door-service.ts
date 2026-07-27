/**
 * mockDoorService — future backend boundary for the door: occupancy,
 * admissions and coat check (plan 17). Occupancy is a counter, never derived
 * from table state — most of the room isn't at a table.
 */
import type { Admission, AdmissionType, CoatCheckTicket, OccupancyEvent } from "@/lib/types";
import { mockAdmissions, mockCoatCheckTickets, mockOccupancyEvents } from "@/lib/mock-data/door";
import { mockVenue } from "@/lib/mock-data/venue";
import { businessDateFor, canApplyOccupancyDelta, computeOccupancy } from "@/lib/door";
import { clone, delay, uid } from "./delay";
import { mockAuditService } from "./audit-service";
import { mockVenueService } from "./venue-service";

let occupancyEvents: OccupancyEvent[] = clone(mockOccupancyEvents);
let admissions: Admission[] = clone(mockAdmissions);
let coatCheckTickets: CoatCheckTicket[] = clone(mockCoatCheckTickets);
let coatCheckCounter = 103;

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
    idCheck?: { checked: boolean; dobVerified: boolean };
    staffId: string;
    staffName: string;
  }): Promise<Admission> {
    await delay(400);
    const date = await currentBusinessDate();
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
      idCheck: input.idCheck ? { ...input.idCheck, byStaffId: input.staffId, at: now } : undefined,
      admittedByStaffId: input.staffId,
      admittedByStaffName: input.staffName,
      admittedAt: now,
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
};
