import type { AdjustmentReason, AuditEntry, ShiftCashout } from "@/lib/types";

/** Seeded per plan 16's design — editable in /manager/settings. */
export const mockAdjustmentReasons: AdjustmentReason[] = [
  { id: "ar-void-1", venueId: "venue-1", kind: "void", code: "wrong-item", label: "Wrong item rung in", isActive: true },
  { id: "ar-void-2", venueId: "venue-1", kind: "void", code: "mis-rung", label: "Mis-rung / duplicate", isActive: true },
  { id: "ar-void-3", venueId: "venue-1", kind: "void", code: "guest-changed-mind", label: "Guest changed mind before delivery", isActive: true },
  { id: "ar-comp-1", venueId: "venue-1", kind: "comp", code: "service-recovery", label: "Service recovery", isActive: true },
  { id: "ar-comp-2", venueId: "venue-1", kind: "comp", code: "house-hospitality", label: "House hospitality", isActive: true },
  { id: "ar-comp-3", venueId: "venue-1", kind: "comp", code: "vip", label: "VIP treatment", isActive: true },
  { id: "ar-comp-4", venueId: "venue-1", kind: "comp", code: "staff-error", label: "Staff error", isActive: true },
  { id: "ar-discount-1", venueId: "venue-1", kind: "discount", code: "negotiated-table", label: "Negotiated table deal", isActive: true },
  { id: "ar-discount-2", venueId: "venue-1", kind: "discount", code: "manager-goodwill", label: "Manager goodwill", isActive: true },
  { id: "ar-discount-3", venueId: "venue-1", kind: "discount", code: "event-deal", label: "Event/promo deal", isActive: true },
];

// ── Audit trail & cash-out seed data ─────────────────────────────────

const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

export const mockAuditEntries: AuditEntry[] = [
  { id: "audit-1", venueId: "venue-1", actorStaffId: "st-viktor", actorName: "Viktor Michaud", action: "door:admit", targetType: "admission", targetId: "adm-1", summary: "Admitted Felix Marchand — party of 4, reservation check-in, VIP tier", createdAt: hoursAgo(3.5) },
  { id: "audit-2", venueId: "venue-1", actorStaffId: "st-viktor", actorName: "Viktor Michaud", action: "door:count", targetType: "occupancy", targetId: "oe-1", summary: "Occupancy +180 — early arrivals admitted", createdAt: hoursAgo(3) },
  { id: "audit-3", venueId: "venue-1", actorStaffId: "st-marcus", actorName: "Marcus Fontaine", action: "door:admit", targetType: "admission", targetId: "adm-2", summary: "Admitted Amelie Roy — walk-in, cover $40, ID verified", createdAt: hoursAgo(2.5) },
  { id: "audit-4", venueId: "venue-1", actorStaffId: "st-amara", actorName: "Amara Belanger", action: "door:admit-banned-override", targetType: "admission", targetId: "adm-5", summary: "Manager override: admitted comp entry despite flag", createdAt: hoursAgo(1.5) },
  { id: "audit-5", venueId: "venue-1", actorStaffId: "st-sofia", actorName: "Sofia Levesque", action: "tab:void", targetType: "order", targetId: "ord-1", summary: "Voided 1x Grey Goose 750ml — wrong table rung", createdAt: hoursAgo(2.2) },
  { id: "audit-6", venueId: "venue-1", actorStaffId: "st-amara", actorName: "Amara Belanger", action: "tab:comp", targetType: "order", targetId: "ord-2", summary: "Comped 1x Moet Imperial — welcome bottle for birthday table VIP-03", createdAt: hoursAgo(1.8) },
  { id: "audit-7", venueId: "venue-1", actorStaffId: "st-amara", actorName: "Amara Belanger", action: "tab:discount", targetType: "order", targetId: "ord-3", summary: "Applied 15% discount — happy hour pricing for MF-06", createdAt: hoursAgo(1.2) },
  { id: "audit-8", venueId: "venue-1", actorStaffId: "st-lucas", actorName: "Lucas Gagne", action: "session:approve", targetType: "session", targetId: "gs-1", summary: "Approved session for Felix + 3 at VIP-01 — VIP, 12 visits, $8.4k lifetime", createdAt: hoursAgo(3.2) },
  { id: "audit-9", venueId: "venue-1", actorStaffId: "st-amara", actorName: "Amara Belanger", action: "guest:ban", targetType: "guest", targetId: "gp-banned-1", summary: "Banned Etienne Boivin — altercation with staff", createdAt: hoursAgo(4) },
  { id: "audit-10", venueId: "venue-1", actorStaffId: "st-viktor", actorName: "Viktor Michaud", action: "incident:create", targetType: "incident", targetId: "inc-1", summary: "Reported altercation — two guests near MF-05", createdAt: hoursAgo(1.5) },
  { id: "audit-11", venueId: "venue-1", actorStaffId: "st-marcus", actorName: "Marcus Fontaine", action: "incident:create", targetType: "incident", targetId: "inc-2", summary: "Refused entry to Etienne Boivin — matched active ban", createdAt: hoursAgo(1) },
  { id: "audit-12", venueId: "venue-1", actorStaffId: "st-sofia", actorName: "Sofia Levesque", action: "service:refuse", targetType: "session", targetId: "gs-4", summary: "Refused further alcohol service — guest on MF-07 visibly intoxicated", createdAt: minsAgo(45) },
  { id: "audit-13", venueId: "venue-1", actorStaffId: "st-amara", actorName: "Amara Belanger", action: "schedule:publish", targetType: "shifts", targetId: "week-2026-07-20", summary: "Published next week schedule — 8 staff across Thu-Sat", createdAt: hoursAgo(5) },
  { id: "audit-14", venueId: "venue-1", actorStaffId: "st-amara", actorName: "Amara Belanger", action: "tips:close-distribution", targetType: "tip-distribution", targetId: "td-fri", summary: "Closed tip distribution for July 24 — $1,850 pool split among 6 staff", createdAt: hoursAgo(1) },
  { id: "audit-15", venueId: "venue-1", actorStaffId: "st-sofia", actorName: "Sofia Levesque", action: "stocktake:commit", targetType: "stocktake", targetId: "st-1", summary: "Committed full stocktake — variance -$40 (1x Grey Goose unaccounted)", createdAt: hoursAgo(2) },
  { id: "audit-16", venueId: "venue-1", actorStaffId: "st-theo", actorName: "Theo Tremblay", action: "inventory:waste", targetType: "stock-movement", targetId: "sm-waste-1", summary: "Recorded waste — 1x Hennessy VS, bottle broken behind bar", createdAt: hoursAgo(3) },
];

export const mockCashouts: ShiftCashout[] = [
  {
    id: "cashout-venue-0724", venueId: "venue-1", businessDate: "2026-07-24",
    openedAt: new Date("2026-07-25T06:00:00-04:00").toISOString(),
    closedAt: new Date("2026-07-25T06:15:00-04:00").toISOString(),
    expectedByMethod: { terminal: 4523000, cash: 1280500, house: 845000 },
    countedByMethod: { terminal: 4523000, cash: 1280000, house: 845000 },
    varianceCents: -500,
    note: "Venue-wide close — $5 short in cash drawer. Within threshold.",
    closedByStaffId: "st-amara", closedByStaffName: "Amara Belanger",
  },
  {
    id: "cashout-sofia-0724", venueId: "venue-1", staffId: "st-sofia", businessDate: "2026-07-24",
    openedAt: new Date("2026-07-25T06:05:00-04:00").toISOString(),
    closedAt: new Date("2026-07-25T06:10:00-04:00").toISOString(),
    expectedByMethod: { terminal: 2100500, cash: 640000, house: 0 },
    countedByMethod: { terminal: 2100500, cash: 640000, house: 0 },
    varianceCents: 0,
    note: "Bartender drawer — bar service. All balanced.",
    closedByStaffId: "st-sofia", closedByStaffName: "Sofia Levesque",
  },
  {
    id: "cashout-venue-0725", venueId: "venue-1", businessDate: "2026-07-25",
    openedAt: new Date("2026-07-26T06:30:00-04:00").toISOString(),
    closedAt: new Date("2026-07-26T06:50:00-04:00").toISOString(),
    expectedByMethod: { terminal: 5210000, cash: 1600000, house: 1200000 },
    countedByMethod: { terminal: 5210000, cash: 1610000, house: 1200000 },
    varianceCents: +10000,
    note: "Venue-wide — $100 over in cash. Likely unreported tip cash left in drawer.",
    closedByStaffId: "st-amara", closedByStaffName: "Amara Belanger",
  },
];
