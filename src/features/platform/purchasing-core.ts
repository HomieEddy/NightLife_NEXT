import type {
  PurchaseOrderStatus,
  StocktakeStatus,
  ProfitTarget,
} from "@/lib/types";

// ── Cost math (unit-testable, no DB) ──────────────────────────────────

/**
 * Weighted average cost after receiving new stock at a new price.
 * WAC = ((currentQty × currentAvg) + (receivedQty × receivedUnitCost)) ÷ (currentQty + receivedQty)
 *
 * This is the canonical formula — no FIFO, no LIFO. Bar inventory systems use
 * WAC because it's simple and defensible (Plan 19, §Interpretation choices).
 */
export function weightedAverageCost(
  currentAvgCents: number,
  currentQty: number,
  receivedQty: number,
  receivedUnitCostCents: number,
): number {
  if (currentQty <= 0 && receivedQty <= 0) return 0;
  if (receivedQty <= 0) return currentAvgCents;
  if (currentQty <= 0) return receivedUnitCostCents;
  const totalCost = currentQty * currentAvgCents + receivedQty * receivedUnitCostCents;
  const totalQty = currentQty + receivedQty;
  return Math.round(totalCost / totalQty);
}

/**
 * Pour cost = COGS ÷ net revenue. Returns a ratio (0–1) or null if no revenue.
 */
export function computePourCost(cogsCents: number, netRevenueCents: number): number | null {
  if (netRevenueCents <= 0) return null;
  return cogsCents / netRevenueCents;
}

/**
 * Gross margin = (net revenue - COGS) ÷ net revenue. Returns ratio or null.
 */
export function computeGrossMargin(cogsCents: number, netRevenueCents: number): number | null {
  if (netRevenueCents <= 0) return null;
  return (netRevenueCents - cogsCents) / netRevenueCents;
}

/**
 * Variance for a single stocktake line. Quantity: counted - expected
 * (negative = shortage, positive = overage). Dollars = variance × avgCostCents.
 */
export function computeVarianceLine(
  expectedQty: number,
  countedQty: number,
  avgCostCents: number,
): { varianceQty: number; varianceCents: number } {
  const varianceQty = countedQty - expectedQty;
  const varianceCents = varianceQty * avgCostCents || 0; // coerce -0 to 0
  return { varianceQty, varianceCents };
}

/**
 * Par level for an item on a given date. Returns undefined if not configured.
 */
export function parForDate(
  parLevels: Record<number, number> | undefined,
  date: Date,
): number | undefined {
  if (!parLevels) return undefined;
  const day = date.getDay();
  return parLevels[day];
}

/**
 * Canonical P&L formula (Plan 19, §Profitability):
 *
 *   netRevenue = grossRevenue - (voids + discounts)
 *   contribution = netRevenue - COGS - labourCost - compCost - wasteCost
 *
 * Returns all components so callers can render the P&L strip.
 */
export interface PnLComponents {
  grossRevenueCents: number;
  voidCents: number;
  discountCents: number;
  netRevenueCents: number;
  cogsCents: number;
  labourCostCents: number;
  compCostCents: number;
  wasteCostCents: number;
  contributionCents: number;
}

export function computeCanonicalPnL(inputs: {
  grossRevenueCents: number;
  voidCents: number;
  discountCents: number;
  cogsCents: number;
  labourCostCents: number;
  compCostCents: number;
  wasteCostCents: number;
}): PnLComponents {
  const netRevenueCents = inputs.grossRevenueCents - (inputs.voidCents + inputs.discountCents);
  const contributionCents =
    netRevenueCents -
    inputs.cogsCents -
    inputs.labourCostCents -
    inputs.compCostCents -
    inputs.wasteCostCents;
  return { ...inputs, netRevenueCents, contributionCents };
}

/**
 * Compute pour cost — convenience wrapper that pulls COGS from the P&L inputs.
 */
export function pourCostFromPnL(inputs: {
  grossRevenueCents: number;
  voidCents: number;
  discountCents: number;
  cogsCents: number;
}): number | null {
  const netRevenue = inputs.grossRevenueCents - (inputs.voidCents + inputs.discountCents);
  return computePourCost(inputs.cogsCents, netRevenue);
}

// ── Unit conversion ───────────────────────────────────────────────────

export type UnitOfMeasure = "bottle" | "ml" | "oz" | "each" | "keg";

/**
 * Convert a quantity between units using the item's servingSize.
 * Serving size = how many base units per bottle (e.g. 750ml → 750).
 * Bottle → base units: qty × servingSize. Base → bottle: qty ÷ servingSize.
 */
export function convertUnits(
  qty: number,
  from: UnitOfMeasure,
  to: UnitOfMeasure,
  servingSize: number,
): number {
  if (from === to) return qty;
  // Convert everything through the base unit (the smallest unit)
  const inBase = from === "bottle" || from === "keg" ? qty * servingSize : qty;
  const out = to === "bottle" || to === "keg" ? inBase / servingSize : inBase;
  return out;
}

/**
 * How many pours (or servings) does the remaining stock represent?
 * A full bottle sold by-the-pour depletes servingSize ml per pour.
 * A bottle sold whole depletes one unit.
 */
export function remainingPours(
  inventory: number,
  unitOfMeasure: UnitOfMeasure | undefined,
  servingSize: number | undefined,
): number {
  if (!servingSize) return inventory;
  const isBulk = unitOfMeasure === "bottle" || unitOfMeasure === "keg";
  return isBulk ? inventory * servingSize : inventory;
}

// ── PO lifecycle state machine ────────────────────────────────────────

const PO_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["partially-received", "received", "cancelled"],
  "partially-received": ["partially-received", "received", "cancelled"],
  received: [],
  cancelled: [],
};

export function poStatusTransition(
  current: PurchaseOrderStatus,
  next: PurchaseOrderStatus,
): { valid: boolean; error?: string } {
  const allowed = PO_TRANSITIONS[current];
  if (!allowed.includes(next)) {
    return {
      valid: false,
      error: `Cannot transition PO from "${current}" to "${next}".`,
    };
  }
  return { valid: true };
}

/**
 * Determine the PO status after receiving lines. If all lines are fully
 * received, status becomes "received"; otherwise "partially-received".
 */
export function poStatusAfterReceive(
  lines: { qtyOrdered: number; qtyReceived: number }[],
): "partially-received" | "received" {
  return lines.every((l) => l.qtyReceived >= l.qtyOrdered) ? "received" : "partially-received";
}

// ── Stocktake lifecycle state machine ─────────────────────────────────

const ST_TRANSITIONS: Record<StocktakeStatus, StocktakeStatus[]> = {
  open: ["counting", "cancelled"],
  counting: ["committed", "cancelled"],
  committed: [],
  cancelled: [],
};

export function stocktakeStatusTransition(
  current: StocktakeStatus,
  next: StocktakeStatus,
): { valid: boolean; error?: string } {
  const allowed = ST_TRANSITIONS[current];
  if (!allowed.includes(next)) {
    return {
      valid: false,
      error: `Cannot transition stocktake from "${current}" to "${next}".`,
    };
  }
  return { valid: true };
}

// ── PO suggestion engine ──────────────────────────────────────────────

/**
 * A single line in a suggested purchase order.
 */
export interface SuggestedPOLine {
  menuItemId: string;
  itemName: string;
  currentStock: number;
  par: number;
  onOrder: number; // qty already on open POs
  leadTimeDays: number;
  suggestedQty: number; // par - (currentStock + onOrder), clamped ≥ 0
  unitCostCents?: number;
  lineTotalCents?: number;
}

/**
 * For each item that's below par for the target date, compute the suggested
 * order quantity accounting for current stock and open PO quantities.
 */
export function suggestPurchaseOrder(inputs: {
  items: {
    menuItemId: string;
    itemName: string;
    currentStock: number;
    parLevels?: Record<number, number>;
    reorderPoint?: number;
    unitCostCents?: number;
  }[];
  openPOQuantities: Record<string, number>; // menuItemId → qty on open POs
  targetDate: Date;
  leadTimeDays: number;
}): SuggestedPOLine[] {
  const lines: SuggestedPOLine[] = [];
  for (const item of inputs.items) {
    const par = parForDate(item.parLevels, inputs.targetDate);
    if (par === undefined && item.reorderPoint === undefined) continue;
    const threshold = par ?? item.reorderPoint ?? 0;
    const onOrder = inputs.openPOQuantities[item.menuItemId] ?? 0;
    const available = item.currentStock + onOrder;
    if (available >= threshold) continue;
    const suggestedQty = threshold - available;
    lines.push({
      menuItemId: item.menuItemId,
      itemName: item.itemName,
      currentStock: item.currentStock,
      par: threshold,
      onOrder,
      leadTimeDays: inputs.leadTimeDays,
      suggestedQty,
      unitCostCents: item.unitCostCents,
      lineTotalCents: item.unitCostCents ? suggestedQty * item.unitCostCents : undefined,
    });
  }
  return lines;
}

// ── Profit target evaluation ──────────────────────────────────────────

/**
 * Check if a metric value breaches its profit target.
 */
export function evaluateProfitTarget(
  target: ProfitTarget,
  currentValue: number,
): { breached: boolean; severity: "none" | "warn" | "critical" } {
  const isBad =
    target.direction === "above"
      ? currentValue > target.warnAt
      : currentValue < target.warnAt;
  if (!isBad) return { breached: false, severity: "none" };
  const isCritical =
    target.direction === "above"
      ? currentValue > target.targetValue
      : currentValue < target.targetValue;
  return {
    breached: true,
    severity: isCritical ? "critical" : "warn",
  };
}

// ── Forecasting (modest — Plan 19 §Forecasting) ───────────────────────

/**
 * Trailing median of same-weekday values for the last N weeks.
 * Maps a list of {date, value} pairs into a median for the given weekday.
 */
export function trailingWeekdayMedian(
  history: { date: string; value: number }[],
  weekday: number,
  weeks: number,
): number | null {
  const values = history
    .filter((h) => {
      const d = new Date(h.date + "T00:00:00");
      return d.getUTCDay() === weekday;
    })
    .slice(0, weeks) // most recent N weeks
    .map((h) => h.value);
  if (values.length === 0) return null;
  values.sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  return values.length % 2 === 0
    ? Math.round((values[mid - 1] + values[mid]) / 2)
    : values[mid];
}
