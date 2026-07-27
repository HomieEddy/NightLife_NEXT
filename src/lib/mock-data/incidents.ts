import type { Incident, IncidentNote } from "@/lib/types";
import { CURRENT_BUSINESS_DATE } from "./door";

const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

/** Two seeded incidents so security's log and the manager's view are non-empty on first paint. */
export const mockIncidents: Incident[] = [
  {
    id: "inc-1",
    venueId: "venue-1",
    businessDate: CURRENT_BUSINESS_DATE,
    type: "altercation",
    severity: "medium",
    occurredAt: minsAgo(50),
    zoneId: "zone-dance",
    involvedStaffIds: ["st-viktor"],
    narrative: "Two guests near MF-05 exchanged words over a spilled drink; separated before it escalated.",
    actionsTaken: "Moved both parties to opposite ends of the floor, monitored for 20 minutes.",
    policeInvolved: false,
    reportedByStaffId: "st-viktor",
    reportedByStaffName: "Viktor Michaud",
    status: "resolved",
  },
  {
    id: "inc-2",
    venueId: "venue-1",
    businessDate: CURRENT_BUSINESS_DATE,
    type: "refused-entry",
    severity: "low",
    occurredAt: minsAgo(30),
    guestProfileId: "gp-banned-1",
    involvedStaffIds: ["st-marcus"],
    narrative: "Étienne Boivin attempted entry at the main door; profile matched an active ban.",
    actionsTaken: "Refused entry, informed of ban reason, no further incident.",
    policeInvolved: false,
    reportedByStaffId: "st-marcus",
    reportedByStaffName: "Marcus Fontaine",
    status: "open",
  },
];

export const mockIncidentNotes: IncidentNote[] = [
  {
    id: "in-1",
    incidentId: "inc-1",
    note: "Followed up with both parties' hosts — no further issues tonight.",
    authorStaffId: "st-amara",
    authorStaffName: "Amara Bélanger",
    createdAt: minsAgo(40),
  },
];
