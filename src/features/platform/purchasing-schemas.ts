import { z } from "zod";

// ── Supplier ─────────────────────────────────────────────────────────

export const zSupplier = z.object({
  id: z.string().min(1),
  venueId: z.string().min(1),
  name: z.string().min(1),
  contactName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  accountNumber: z.string().optional(),
  leadTimeDays: z.number().int().min(0),
  orderDays: z.array(z.number().int().min(0).max(6)),
  minimumOrderCents: z.number().int().optional(),
  notes: z.string().optional(),
  active: z.boolean(),
});

// ── Supplier item ────────────────────────────────────────────────────

export const zSupplierItem = z.object({
  id: z.string().min(1),
  supplierId: z.string().min(1),
  menuItemId: z.string().min(1),
  supplierSku: z.string().optional(),
  caseSize: z.number().int().positive().optional(),
  caseCostCents: z.number().int().min(0).optional(),
  unitCostCents: z.number().int().min(0).optional(),
  lastPriceChangeAt: z.string().optional(),
  preferred: z.boolean(),
});

// ── Purchase order ───────────────────────────────────────────────────

export const zPOLine = z.object({
  id: z.string().min(1),
  menuItemId: z.string().min(1),
  qtyOrdered: z.number().int().positive(),
  qtyReceived: z.number().int().min(0),
  unitCostCents: z.number().int().min(0),
  lineTotalCents: z.number().int().min(0),
});

export const zPurchaseOrder = z.object({
  id: z.string().min(1),
  venueId: z.string().min(1),
  supplierId: z.string().min(1),
  code: z.string().min(1),
  status: z.enum(["draft", "submitted", "partially-received", "received", "cancelled"]),
  expectedAt: z.string().optional(),
  submittedAt: z.string().optional(),
  submittedByStaffId: z.string().optional(),
  lines: z.array(zPOLine),
  subtotalCents: z.number().int().min(0),
  notes: z.string().optional(),
});

export const zReceiveLines = z.object({
  lines: z.array(
    z.object({
      lineId: z.string().min(1),
      qtyReceived: z.number().int().positive(),
    }),
  ),
});

// ── Stocktake ────────────────────────────────────────────────────────

export const zStocktakeLine = z.object({
  id: z.string().min(1),
  menuItemId: z.string().min(1),
  expectedQty: z.number().int().min(0),
  countedQty: z.number().int().min(0).optional(),
  secondCountQty: z.number().int().min(0).optional(),
  varianceQty: z.number().int(),
  varianceCents: z.number().int(),
  countedByStaffId: z.string().optional(),
});

export const zStocktake = z.object({
  id: z.string().min(1),
  venueId: z.string().min(1),
  businessDate: z.string().min(1),
  scope: z.enum(["full", "zone", "category"]),
  status: z.enum(["open", "counting", "committed", "cancelled"]),
  startedAt: z.string().min(1),
  committedAt: z.string().optional(),
  startedByStaffId: z.string().min(1),
  lines: z.array(zStocktakeLine),
  totalVarianceCents: z.number().int(),
});

// ── 86 entry ─────────────────────────────────────────────────────────

export const zEightySix = z.object({
  itemId: z.string().min(1),
  reason: z.string().min(1),
  staffId: z.string().min(1),
});

// ── Waste ────────────────────────────────────────────────────────────

export const zWaste = z.object({
  itemId: z.string().min(1),
  quantity: z.number().positive(),
  reason: z.string().min(1),
  staffId: z.string().min(1),
});

// ── Profit target ────────────────────────────────────────────────────

export const zProfitTarget = z.object({
  id: z.string().min(1),
  venueId: z.string().min(1),
  metric: z.enum(["pour-cost", "gross-margin", "labour-pct", "comp-pct"]),
  scope: z.enum(["venue", "category"]),
  categoryId: z.string().optional(),
  targetValue: z.number(),
  warnAt: z.number(),
  direction: z.enum(["above", "below"]),
});

// ── Event cost ───────────────────────────────────────────────────────

export const zEventCost = z.object({
  id: z.string().min(1),
  eventId: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(["talent", "marketing", "production", "other"]),
  amountCents: z.number().int().min(0),
});

// ── Event run sheet ──────────────────────────────────────────────────

export const zEventRunSheetEntry = z.object({
  time: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
});

export const zSaveRunSheet = z.object({
  eventId: z.string().min(1),
  entries: z.array(zEventRunSheetEntry),
});

// ── Inventory checklist ──────────────────────────────────────────────

export const zInventoryChecklistEntry = z.object({
  id: z.string().min(1),
  menuItemId: z.string().min(1),
  itemName: z.string().min(1),
  expectedCount: z.number().int().min(0),
  actualCount: z.number().int().min(0).optional(),
  checked: z.boolean(),
  checkedByStaffId: z.string().optional(),
  checkedAt: z.string().optional(),
});

export const zInventoryChecklist = z.object({
  id: z.string().min(1),
  venueId: z.string().min(1),
  businessDate: z.string().min(1),
  type: z.enum(["pre-service", "post-service"]),
  status: z.enum(["open", "completed"]),
  lines: z.array(zInventoryChecklistEntry),
  startedAt: z.string().min(1),
  completedAt: z.string().optional(),
});
