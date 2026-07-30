import { z } from "zod";
import { ASSIGNABLE_ROLES } from "@/lib/types";

// ── Time entry schemas ──────────────────────────────────────────────

export const zClockIn = z.object({
  staffId: z.string().min(1),
  shiftId: z.string().optional(),
});

export const zClockOut = z.object({
  staffId: z.string().min(1),
});

export const zBreakAction = z.object({
  staffId: z.string().min(1),
});

export const zEditEntry = z.object({
  entryId: z.string().min(1),
  clockInAt: z.string().optional(),
  clockOutAt: z.string().optional(),
  minutesWorked: z.number().int().min(0).optional(),
  editorId: z.string().min(1),
  reason: z.string().min(1),
});

// ── Shift schemas ──────────────────────────────────────────────────

export const zPublishShifts = z.object({
  shiftIds: z.array(z.string().min(1)).min(1),
});

// ── Time-off schemas ───────────────────────────────────────────────

export const zTimeOffRequest = z.object({
  venueId: z.string().min(1),
  staffId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().min(1),
});

export const zApproveTimeOff = z.object({
  approved: z.boolean(),
  deciderId: z.string().min(1),
});

// ── Swap schemas ───────────────────────────────────────────────────

export const zSwapRequest = z.object({
  venueId: z.string().min(1),
  shiftId: z.string().min(1),
  requestedByStaffId: z.string().min(1),
  offeredToStaffId: z.string().optional(),
});

export const zApproveSwap = z.object({
  approved: z.boolean(),
  deciderId: z.string().min(1),
});

export const zClaimSwap = z.object({
  staffId: z.string().min(1),
});

// ── Tip pool schemas ───────────────────────────────────────────────

export const zTipPoolRule = z.object({
  id: z.string().min(1),
  venueId: z.string().min(1),
  name: z.string().min(1),
  basis: z.enum(["hours-weighted", "equal", "role-percentage"]),
  rolePercentages: z.record(z.enum(ASSIGNABLE_ROLES), z.number()).optional(),
  includeRoles: z.array(z.enum(ASSIGNABLE_ROLES)),
  houseRetentionPct: z.number().int().min(0).max(100),
  active: z.boolean(),
});

export const zCloseDistribution = z.object({
  closerId: z.string().min(1),
});

// ── Commission schemas ─────────────────────────────────────────────

export const zCommissionRule = z.object({
  id: z.string().min(1),
  venueId: z.string().min(1),
  staffId: z.string().optional(),
  appliesToRole: z.enum(ASSIGNABLE_ROLES).optional(),
  basis: z.enum(["net-revenue", "table-minimum", "per-head", "per-reservation"]),
  ratePct: z.number().min(0).max(100).optional(),
  flatCents: z.number().int().min(0).optional(),
  qualifier: z.object({
    minPartySize: z.number().int().min(0).optional(),
    channels: z.array(z.enum(["embed", "direct", "walk-in", "promoter"])).optional(),
  }).optional(),
});

export const zCommissionStatement = z.object({
  id: z.string().min(1),
  venueId: z.string().min(1),
  staffId: z.string().min(1),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  lines: z.array(z.object({
    sourceType: z.enum(["reservation", "session", "order"]),
    sourceId: z.string().min(1),
    basisCents: z.number().int().min(0),
    earnedCents: z.number().int().min(0),
  })),
  totalCents: z.number().int().min(0),
  status: z.enum(["draft", "approved"]),
});

export const zApproveStatement = z.object({
  approverId: z.string().min(1),
});

// ── Staff assignment & handoff schemas ─────────────────────────────

export const zAssignTables = z.object({
  staffId: z.string().min(1),
  tableIds: z.array(z.string().min(1)).min(1),
  zoneId: z.string().min(1),
  shiftId: z.string().optional(),
});

export const zGenerateHandoff = z.object({
  fromStaffId: z.string().min(1),
  fromStaffName: z.string().min(1),
  toStaffId: z.string().optional(),
  toStaffName: z.string().optional(),
  openIncidents: z.array(z.string()).default([]),
  vipNotes: z.string().default(""),
  inventoryAlerts: z.string().default(""),
  specialInstructions: z.string().default(""),
});

export const zAcknowledgeHandoff = z.object({
  staffId: z.string().min(1),
  staffName: z.string().min(1),
});
