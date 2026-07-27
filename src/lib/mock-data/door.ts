import type { Admission, CoatCheckTicket, OccupancyEvent, WaitlistEntry } from "@/lib/types";
import { mockVenue } from "./venue";
import { businessDateFor } from "@/lib/tab";

const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

/** Tonight's business date, bucketed the same way as everything else (never toDateString()). */
export const CURRENT_BUSINESS_DATE = businessDateFor(new Date().toISOString(), mockVenue.nightEndHour);

// Nets to 264 tonight (180 + 64 + 32 − 12), out of legalCapacity 400 — 0.66 of
// capacity, partway there but well under the 0.9 occupancyWarnRatio.
export const mockOccupancyEvents: OccupancyEvent[] = [
  { id: "oe-1", venueId: "venue-1", businessDate: CURRENT_BUSINESS_DATE, delta: 180, reason: "door open — early arrivals", staffId: "st-viktor", at: minsAgo(180) },
  { id: "oe-2", venueId: "venue-1", businessDate: CURRENT_BUSINESS_DATE, delta: 64, reason: "walk-ins", staffId: "st-viktor", at: minsAgo(90) },
  { id: "oe-3", venueId: "venue-1", businessDate: CURRENT_BUSINESS_DATE, delta: 32, reason: "reservations seated", staffId: "st-marcus", at: minsAgo(45) },
  { id: "oe-4", venueId: "venue-1", businessDate: CURRENT_BUSINESS_DATE, delta: -12, reason: "exits", staffId: "st-marcus", at: minsAgo(20) },
];

export const mockAdmissions: Admission[] = [
  {
    id: "adm-1", venueId: "venue-1", businessDate: CURRENT_BUSINESS_DATE,
    guestProfileId: "gp-felix", partySize: 4, admissionType: "reservation", amountOwedCents: 0,
    source: "reservation", reservationId: "res-1",
    admittedByStaffId: "st-viktor", admittedByStaffName: "Viktor Michaud", admittedAt: minsAgo(75),
  },
  {
    id: "adm-2", venueId: "venue-1", businessDate: CURRENT_BUSINESS_DATE,
    guestProfileId: "gp-amelie", partySize: 2, admissionType: "cover", amountOwedCents: 4000,
    source: "walk-in", idCheck: { checked: true, dobVerified: true, byStaffId: "st-marcus", at: minsAgo(60) },
    admittedByStaffId: "st-marcus", admittedByStaffName: "Marcus Fontaine", admittedAt: minsAgo(60),
  },
  {
    id: "adm-3", venueId: "venue-1", businessDate: CURRENT_BUSINESS_DATE,
    partySize: 3, admissionType: "cover", amountOwedCents: 6000,
    source: "walk-in", idCheck: { checked: true, dobVerified: true, byStaffId: "st-viktor", at: minsAgo(30) },
    admittedByStaffId: "st-viktor", admittedByStaffName: "Viktor Michaud", admittedAt: minsAgo(30),
  },
];

export const mockWaitlistEntries: WaitlistEntry[] = [
  { id: "wl-1", venueId: "venue-1", name: "Julien Roy", partySize: 4, phone: "+15145550911", quotedMinutes: 20, status: "waiting", joinedAt: minsAgo(18) },
  { id: "wl-2", venueId: "venue-1", name: "Béatrice Fortin", partySize: 2, quotedMinutes: 15, status: "waiting", joinedAt: minsAgo(9) },
  { id: "wl-3", venueId: "venue-1", name: "Simon Caron", partySize: 6, quotedMinutes: 30, status: "notified", joinedAt: minsAgo(35), notifiedAt: minsAgo(4) },
];

export const mockCoatCheckTickets: CoatCheckTicket[] = [
  { id: "cc-101", venueId: "venue-1", businessDate: CURRENT_BUSINESS_DATE, ticketNumber: 101, itemCount: 2, checkedInAt: minsAgo(80), staffId: "st-viktor" },
  { id: "cc-102", venueId: "venue-1", businessDate: CURRENT_BUSINESS_DATE, ticketNumber: 102, itemCount: 1, checkedInAt: minsAgo(50), claimedAt: minsAgo(5), staffId: "st-marcus" },
];
