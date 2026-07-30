/**
 * Zod schemas for tab ledger & financial controls (plan 16).
 * One schema per route handler input — validates at the boundary (AD-7).
 */
import { z } from "zod";

// ── Adjustment reasons ─────────────────────────────────────────────────

export const zCreateAdjustmentReason = z.object({
  kind: z.enum(["void", "comp", "discount"]),
  code: z.string().min(1).max(50),
  label: z.string().min(1).max(200),
});

export const zToggleReasonActive = z.object({
  isActive: z.boolean(),
});

// ── Tab adjustments ────────────────────────────────────────────────────

export const zAdjustOrder = z.object({
  orderId: z.string().min(1),
  orderItemId: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  kind: z.enum(["void", "comp", "discount"]),
  reasonCode: z.string().min(1),
  note: z.string().optional(),
  authorStaffId: z.string().min(1),
  authorStaffName: z.string().min(1),
});

export const zReverseAdjustment = z.object({
  staffId: z.string().min(1),
  staffName: z.string().min(1),
});

// ── Session transfer / merge / reassign ────────────────────────────────

export const zTransferSession = z.object({
  toTableId: z.string().min(1),
  toTableCode: z.string().min(1),
  toZoneName: z.string().min(1),
  staffId: z.string().min(1),
  staffName: z.string().min(1),
});

export const zMergeSession = z.object({
  parentSessionId: z.string().min(1),
  staffId: z.string().min(1),
  staffName: z.string().min(1),
});

export const zReassignOrders = z.object({
  toSessionId: z.string().min(1),
});

// ── Audit ──────────────────────────────────────────────────────────────

export const zRecordAudit = z.object({
  actorStaffId: z.string().min(1),
  actorName: z.string().min(1),
  action: z.string().min(1),
  targetType: z.string().min(1),
  targetId: z.string().min(1),
  summary: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const zListAudit = z.object({
  actorStaffId: z.string().optional(),
  action: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

// ── Cash-out ───────────────────────────────────────────────────────────

export const zCloseCashout = z.object({
  staffId: z.string().optional(),
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expectedByMethod: z.object({
    terminal: z.number().int().min(0),
    cash: z.number().int().min(0),
    house: z.number().int().min(0),
  }),
  countedByMethod: z.object({
    terminal: z.number().int().min(0),
    cash: z.number().int().min(0),
    house: z.number().int().min(0),
  }),
  note: z.string().optional(),
  closedByStaffId: z.string().min(1),
  closedByStaffName: z.string().min(1),
});

// ── Order extras ───────────────────────────────────────────────────────

export const zRushOrder = z.object({
  staffName: z.string().min(1),
});

export const zCompEntireOrder = z.object({
  reasonCode: z.string().min(1),
  staffId: z.string().min(1),
  staffName: z.string().min(1),
});

export const zRemakeOrder = z.object({
  newOrderId: z.string().min(1),
  reason: z.string().min(1),
  staffId: z.string().min(1),
  staffName: z.string().min(1),
});

export const zReportWalkout = z.object({
  sessionId: z.string().min(1),
  description: z.string().min(1),
  staffId: z.string().min(1),
  staffName: z.string().min(1),
});

// Route-body variant — sessionId comes from URL params.
export const zReportWalkoutBody = zReportWalkout.omit({ sessionId: true });

// ── Session extras ──────────────────────────────────────────────────────

export const zSplitBill = z.object({
  sessionId: z.string().min(1),
  splits: z.array(
    z.object({
      label: z.string().min(1),
      orderItemIds: z.array(z.string().min(1)),
    }),
  ),
});

// Route-body variant — sessionId comes from URL params.
export const zSplitBillBody = zSplitBill.omit({ sessionId: true });
