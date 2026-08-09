import type { getDb } from "@/features/shared/db";
import type {
  PurchaseOrderStatus,
  StocktakeStatus,
  ProfitTarget,
  Supplier,
  SupplierItem,
  PurchaseOrder,
  Stocktake,
  EightySixEntry,
  EventCost,
  InventoryChecklist,
  PriceChange,
} from "@/lib/types";

type ScopedDb = ReturnType<typeof getDb>;

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

// ── DB-backed functions (called from route handlers) ────────────────────

// Prisma extension injects venueId; cast to any for the exact types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

function toISO(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return String(v ?? "");
}

function assertRow<T>(row: T): asserts row is NonNullable<T> {
  if (!row) throw new Error("Record not found.");
}

// ── Suppliers ────────────────────────────────────────────────────────

export async function listSuppliers(db: ScopedDb): Promise<Supplier[]> {
  const rows = await db.supplier.findMany({ orderBy: { name: "asc" } });
  return rows.map((r: Row) => ({
    id: r.id, venueId: r.venue_id, name: r.name, contactName: r.contact_name,
    email: r.email, phone: r.phone, accountNumber: r.account_number,
    leadTimeDays: r.lead_time_days, orderDays: r.order_days,
    minimumOrderCents: r.minimum_order_cents, notes: r.notes, active: r.active,
  }));
}

export async function saveSupplier(db: ScopedDb, supplier: Supplier): Promise<Supplier> {
  const exists = await db.supplier.findUnique({ where: { id: supplier.id } });
  const data = {
    id: supplier.id, name: supplier.name, contactName: supplier.contactName,
    email: supplier.email, phone: supplier.phone, accountNumber: supplier.accountNumber,
    leadTimeDays: supplier.leadTimeDays, orderDays: supplier.orderDays,
    minimumOrderCents: supplier.minimumOrderCents, notes: supplier.notes,
    active: supplier.active,
  };
  if (exists) await db.supplier.update({ where: { id: supplier.id }, data });
  else await db.supplier.create({ data } as Row);
  return supplier;
}

// ── Supplier items ───────────────────────────────────────────────────

export async function listSupplierItems(db: ScopedDb, supplierId?: string): Promise<SupplierItem[]> {
  const where = supplierId ? { supplierId } : {};
  const rows = await db.supplierItem.findMany({ where });
  return rows.map((r: Row) => ({
    id: r.id, supplierId: r.supplierId, menuItemId: r.menuItemId,
    supplierSku: r.supplierSku, caseSize: r.caseSize,
    caseCostCents: r.caseCostCents, unitCostCents: r.unitCostCents,
    lastPriceChangeAt: r.lastPriceChangeAt instanceof Date ? r.lastPriceChangeAt.toISOString() : (typeof r.lastPriceChangeAt === "string" ? r.lastPriceChangeAt : undefined),
    preferred: r.preferred,
  }));
}

export async function saveSupplierItem(db: ScopedDb, si: SupplierItem): Promise<SupplierItem> {
  const exists = await db.supplierItem.findUnique({ where: { id: si.id } });
  const data = {
    id: si.id, supplierId: si.supplierId, menuItemId: si.menuItemId,
    supplierSku: si.supplierSku, caseSize: si.caseSize,
    caseCostCents: si.caseCostCents, unitCostCents: si.unitCostCents,
    lastPriceChangeAt: si.lastPriceChangeAt ? new Date(si.lastPriceChangeAt) : undefined,
    preferred: si.preferred,
  };
  if (exists) await db.supplierItem.update({ where: { id: si.id }, data });
  else await db.supplierItem.create({ data } as Row);
  return si;
}

export async function removeSupplierItem(db: ScopedDb, siId: string): Promise<void> {
  await db.supplierItem.delete({ where: { id: siId } });
}

// ── Purchase orders ──────────────────────────────────────────────────

function poRowToDTO(r: Row): PurchaseOrder {
  const lines = (r.lines as Array<Row> | undefined) ?? [];
  return {
    id: r.id, venueId: r.venue_id ?? r.venueId,
    supplierId: r.supplier_id ?? r.supplierId, code: r.code,
    status: r.status as PurchaseOrderStatus,
    expectedAt: r.expected_at ? toISO(r.expected_at) : undefined,
    submittedAt: r.submitted_at ? toISO(r.submitted_at) : undefined,
    submittedByStaffId: (r.submittedByStaffId ?? r.submitted_by_staff_id) as string | undefined,
    lines: lines.map((l: Row) => ({
      id: l.id, menuItemId: l.menuItemId ?? l.menu_item_id,
      qtyOrdered: l.qtyOrdered ?? l.qty_ordered,
      qtyReceived: l.qtyReceived ?? l.qty_received,
      unitCostCents: l.unitCostCents ?? l.unit_cost_cents,
      lineTotalCents: l.lineTotalCents ?? l.line_total_cents,
    })),
    subtotalCents: r.subtotal_cents ?? r.subtotalCents, notes: r.notes,
  };
}

export async function listPurchaseOrders(db: ScopedDb, supplierId?: string): Promise<PurchaseOrder[]> {
  const where = supplierId ? { supplierId } : {};
  const rows = await db.purchaseOrder.findMany({ where, orderBy: { expectedAt: "desc" } });
  return rows.map(poRowToDTO);
}

export async function savePurchaseOrder(db: ScopedDb, po: PurchaseOrder): Promise<PurchaseOrder> {
  const exists = await db.purchaseOrder.findUnique({ where: { id: po.id } });
  const data = {
    id: po.id, code: po.code, supplierId: po.supplierId, status: po.status,
    expectedAt: po.expectedAt ? new Date(po.expectedAt) : undefined,
    subtotalCents: po.subtotalCents, notes: po.notes,
    lines: po.lines as Row,
  };
  if (exists) await db.purchaseOrder.update({ where: { id: po.id }, data });
  else await db.purchaseOrder.create({ data } as Row);
  return po;
}

export async function submitPurchaseOrder(db: ScopedDb, poId: string, staffId: string): Promise<PurchaseOrder> {
  const po = await db.purchaseOrder.findUnique({ where: { id: poId } });
  assertRow(po);
  if (po.status !== "draft") throw new Error("Only draft POs can be submitted.");
  await db.purchaseOrder.update({
    where: { id: poId },
    data: { status: "submitted", submittedAt: new Date(), submittedByStaffId: staffId },
  });
  const updated = await db.purchaseOrder.findUnique({ where: { id: poId } });
  assertRow(updated);
  return poRowToDTO(updated);
}

export async function receivePurchaseOrder(
  db: ScopedDb, poId: string, lines: { lineId: string; qtyReceived: number }[],
): Promise<PurchaseOrder> {
  const po = await db.purchaseOrder.findUnique({ where: { id: poId } });
  assertRow(po);
  if (po.status !== "submitted" && po.status !== "partially-received") {
    throw new Error("PO must be submitted or partially-received before receiving.");
  }
  const poLines = (po.lines as Row[]) as {
    id: string; menuItemId: string; qtyOrdered: number; qtyReceived: number;
    unitCostCents: number; lineTotalCents: number;
  }[];
  const receiptMap = new Map(lines.map((l) => [l.lineId, l.qtyReceived]));
  for (const line of poLines) {
    const received = receiptMap.get(line.id);
    if (!received || received <= 0) continue;
    const newQtyReceived = line.qtyReceived + received;
    if (newQtyReceived > line.qtyOrdered) {
      throw new Error(`Over-receipt on line ${line.id}: ordered ${line.qtyOrdered}, would receive ${newQtyReceived}.`);
    }
    line.qtyReceived = newQtyReceived;
    const item = await db.menuItem.findUnique({ where: { id: line.menuItemId } });
    if (item && received > 0) {
      const newAvg = weightedAverageCost(item.avgCostCents ?? line.unitCostCents, item.inventory, received, line.unitCostCents);
      await db.menuItem.update({ where: { id: line.menuItemId }, data: { inventory: { increment: received }, avgCostCents: newAvg } });
      await db.stockMovement.create({
        data: { menuItemId: line.menuItemId, itemName: item.name, type: "restock", delta: received, unitCostCents: line.unitCostCents, purchaseOrderId: poId, note: `Received PO ${po.code}` },
      } as Row);
      // Track price changes on the supplier item
      const si = await db.supplierItem.findFirst({ where: { supplierId: po.supplierId, menuItemId: line.menuItemId } });
      if (si && (si as Row).unitCostCents !== line.unitCostCents) {
        await db.supplierItem.update({
          where: { id: si.id },
          data: { unitCostCents: line.unitCostCents, lastPriceChangeAt: new Date() },
        } as Row);
      }
    }
  }
  const newStatus = poStatusAfterReceive(poLines);
  await db.purchaseOrder.update({ where: { id: poId }, data: { status: newStatus, lines: poLines as Row } });
  const updated = await db.purchaseOrder.findUnique({ where: { id: poId } });
  assertRow(updated);
  return poRowToDTO(updated);
}

/**
 * Compare received unit costs against the last known price from the supplier item.
 * Returns any changes exceeding the threshold (default 15%).
 */
export async function detectPriceChanges(
  db: ScopedDb,
  supplierId: string,
  lines: { menuItemId: string; unitCostCents: number }[],
  thresholdPercent = 15,
): Promise<PriceChange[]> {
  const changes: PriceChange[] = [];
  for (const line of lines) {
    const si = await db.supplierItem.findFirst({
      where: { supplierId, menuItemId: line.menuItemId },
    });
    const prevCost = (si as Row)?.unitCostCents as number | undefined;
    if (!prevCost || prevCost === 0) continue;
    if (prevCost === line.unitCostCents) continue;
    const changePercent = Math.round(((line.unitCostCents - prevCost) / prevCost) * 100);
    if (Math.abs(changePercent) > thresholdPercent) {
      const item = await db.menuItem.findUnique({ where: { id: line.menuItemId } });
      changes.push({
        menuItemId: line.menuItemId,
        itemName: (item as Row)?.name ?? line.menuItemId,
        previousUnitCostCents: prevCost,
        newUnitCostCents: line.unitCostCents,
        changePercent,
      });
    }
  }
  return changes;
}

// ── Stocktakes ───────────────────────────────────────────────────────

function stRowToDTO(r: Row): Stocktake {
  const lines = (r.lines as Array<Row> | undefined) ?? [];
  return {
    id: r.id, venueId: r.venue_id ?? r.venueId, businessDate: r.business_date ?? r.businessDate,
    scope: r.scope, status: r.status as StocktakeStatus,
    startedAt: toISO(r.started_at ?? r.startedAt),
    committedAt: r.committed_at ? toISO(r.committed_at) : undefined,
    startedByStaffId: r.started_by_staff_id ?? r.startedByStaffId,
    lines: lines.map((l: Row) => ({
      id: l.id, menuItemId: l.menuItemId ?? l.menu_item_id,
      expectedQty: l.expectedQty ?? l.expected_qty,
      countedQty: l.countedQty ?? l.counted_qty,
      secondCountQty: l.secondCountQty ?? l.second_count_qty,
      varianceQty: l.varianceQty ?? l.variance_qty,
      varianceCents: l.varianceCents ?? l.variance_cents,
      countedByStaffId: l.countedByStaffId ?? l.counted_by_staff_id,
    })),
    totalVarianceCents: r.total_variance_cents ?? r.totalVarianceCents,
  };
}

export async function listStocktakes(db: ScopedDb): Promise<Stocktake[]> {
  const rows = await db.stocktake.findMany({ orderBy: { startedAt: "desc" } });
  return rows.map(stRowToDTO);
}

export async function saveStocktake(db: ScopedDb, st: Stocktake): Promise<Stocktake> {
  const exists = await db.stocktake.findUnique({ where: { id: st.id } });
  const data = {
    id: st.id, businessDate: st.businessDate, scope: st.scope, status: st.status,
    lines: st.lines as Row, totalVarianceCents: st.totalVarianceCents,
  };
  if (exists) await db.stocktake.update({ where: { id: st.id }, data });
  else await db.stocktake.create({ data: { ...data, startedAt: new Date(st.startedAt), startedByStaffId: st.startedByStaffId } } as Row);
  return st;
}

export async function commitStocktake(db: ScopedDb, stId: string): Promise<Stocktake> {
  // One transaction: every movement, inventory update and the status flip
  // commit together, or none do. The final CAS (status → committed) is the
  // concurrency guard — a second concurrent commit reads the old status,
  // applies its movements, then claims 0 rows and rolls the whole batch back.
  return db.$transaction(async (tx) => {
    const st = await tx.stocktake.findUnique({ where: { id: stId } });
    assertRow(st);
    if (st.status !== "counting") throw new Error("Only a stocktake in 'counting' status can be committed.");
    const stLines = (st.lines as Array<Row>) as {
      id: string; menuItemId: string; varianceQty: number; varianceCents: number;
    }[];
    for (const line of stLines) {
      if (line.varianceQty === 0) continue;
      const item = await tx.menuItem.findUnique({ where: { id: line.menuItemId } });
      const itemName = item?.name ?? line.menuItemId;
      await tx.stockMovement.create({
        data: { menuItemId: line.menuItemId, itemName, type: "adjustment", delta: line.varianceQty, note: `Stocktake ${st.businessDate} — count variance`, stocktakeId: stId },
      } as Row);
      if (item) {
        await tx.menuItem.update({ where: { id: line.menuItemId }, data: { inventory: { increment: line.varianceQty } } });
      }
    }
    const totalVarianceCents = stLines.reduce((sum, l) => sum + (l.varianceCents ?? 0), 0);
    const claimed = await tx.stocktake.updateMany({
      where: { id: stId, status: "counting" },
      data: { status: "committed", committedAt: new Date(), totalVarianceCents },
    });
    if (claimed.count === 0) {
      throw new Error("Stocktake was already committed by another process.");
    }
    const updated = await tx.stocktake.findUnique({ where: { id: stId } });
    assertRow(updated);
    return stRowToDTO(updated);
  });
}

// ── Eighty-six entries ───────────────────────────────────────────────

export async function listEightySixEntries(db: ScopedDb): Promise<EightySixEntry[]> {
  const rows = await db.eightySixEntry.findMany({ orderBy: { at: "desc" } });
  return rows.map((r: Row) => ({
    id: r.id, menuItemId: r.menu_item_id ?? r.menuItemId,
    reason: r.reason, byStaffId: r.by_staff_id ?? r.byStaffId,
    at: toISO(r.at), reinstatedAt: r.reinstated_at ? toISO(r.reinstated_at) : undefined,
  }));
}

export async function eightySixItem(db: ScopedDb, itemId: string, reason: string, staffId: string): Promise<EightySixEntry> {
  const entry = await db.eightySixEntry.create({ data: { menuItemId: itemId, reason, byStaffId: staffId, at: new Date() } } as Row) as Row;
  return { id: entry.id, menuItemId: entry.menuItemId ?? entry.menu_item_id, reason: entry.reason, byStaffId: entry.byStaffId ?? entry.by_staff_id, at: toISO(entry.at) };
}

// ── Waste ────────────────────────────────────────────────────────────

export async function recordWaste(
  db: ScopedDb,
  venueId: string,
  itemId: string,
  quantity: number,
  reason: string,
  _staffId: string,
): Promise<Row> {
  const absQty = Math.abs(quantity);
  // Movement and inventory update commit together with a locked read — the
  // old version read inventory outside the tx and clamped at 0, letting the
  // ledger diverge (movement -5, inventory only -3).
  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRawUnsafe<{ id: string; name: string; inventory: number }[]>(
      `SELECT id, name, inventory FROM menu_items WHERE id = $1 AND venue_id = $2 FOR UPDATE`,
      itemId,
      venueId,
    );
    const item = locked[0];
    const itemName = item?.name ?? itemId;
    const mvt = await tx.stockMovement.create({
      data: { venueId, menuItemId: itemId, itemName, type: "waste", delta: -absQty, wasteReason: reason, note: reason },
    } as Row) as Row;
    if (item) {
      await tx.menuItem.update({ where: { id: itemId }, data: { inventory: item.inventory - absQty } });
    }
    return mvt;
  }).then((mvt) => ({
    id: mvt.id,
    menuItemId: mvt.menuItemId ?? mvt.menu_item_id,
    itemName: mvt.itemName ?? mvt.item_name,
    type: mvt.type,
    delta: mvt.delta,
    note: mvt.note ?? reason,
    wasteReason: mvt.wasteReason ?? mvt.waste_reason ?? reason,
    createdAt: toISO(mvt.created_at ?? mvt.createdAt),
  }));
}

// ── Profit targets ───────────────────────────────────────────────────

export async function listProfitTargets(db: ScopedDb): Promise<ProfitTarget[]> {
  const rows = await db.profitTarget.findMany();
  return rows.map((r: Row) => ({
    id: r.id, venueId: r.venue_id ?? r.venueId, metric: r.metric,
    scope: r.scope, categoryId: r.category_id ?? r.categoryId,
    targetValue: r.target_value ?? r.targetValue,
    warnAt: r.warn_at ?? r.warnAt, direction: r.direction,
  }));
}

export async function saveProfitTarget(db: ScopedDb, pt: ProfitTarget): Promise<ProfitTarget> {
  const exists = await db.profitTarget.findUnique({ where: { id: pt.id } });
  const data = { id: pt.id, metric: pt.metric, scope: pt.scope, categoryId: pt.categoryId, targetValue: pt.targetValue, warnAt: pt.warnAt, direction: pt.direction };
  if (exists) await db.profitTarget.update({ where: { id: pt.id }, data });
  else await db.profitTarget.create({ data } as Row);
  return pt;
}

// ── Event costs ──────────────────────────────────────────────────────

export async function listEventCosts(db: ScopedDb, eventId?: string): Promise<EventCost[]> {
  const where = eventId ? { eventId } : {};
  const rows = await db.eventCost.findMany({ where });
  return rows.map((r: Row) => ({ id: r.id, eventId: r.event_id ?? r.eventId, label: r.label, kind: r.kind, amountCents: r.amount_cents ?? r.amountCents }));
}

export async function saveEventCost(db: ScopedDb, ec: EventCost): Promise<EventCost> {
  const exists = await db.eventCost.findUnique({ where: { id: ec.id } });
  const data = { id: ec.id, eventId: ec.eventId, label: ec.label, kind: ec.kind, amountCents: ec.amountCents };
  if (exists) await db.eventCost.update({ where: { id: ec.id }, data });
  else await db.eventCost.create({ data } as Row);
  return ec;
}

// ── Inventory checklists ─────────────────────────────────────────────

function clRowToDTO(r: Row): InventoryChecklist {
  const lines = (r.items as Array<Row> | undefined) ?? [];
  return {
    id: r.id, venueId: r.venue_id ?? r.venueId, businessDate: r.business_date ?? r.businessDate,
    type: r.type, status: r.status,
    lines: lines.map((l: Row) => ({
      id: l.id, menuItemId: l.menuItemId ?? l.menu_item_id, itemName: l.itemName ?? l.item_name,
      expectedCount: l.expectedCount ?? l.expected_count, actualCount: l.actualCount ?? l.actual_count,
      checked: l.checked, checkedByStaffId: l.checkedByStaffId ?? l.checked_by_staff_id,
      checkedAt: l.checkedAt ?? l.checked_at,
    })),
    startedAt: toISO(r.started_at ?? r.startedAt),
    completedAt: r.completed_at ? toISO(r.completed_at) : undefined,
  };
}

export async function listInventoryChecklists(db: ScopedDb, type?: "pre-service" | "post-service"): Promise<InventoryChecklist[]> {
  const where = type ? { type } : {};
  const rows = await db.checklistRun.findMany({ where, orderBy: { startedAt: "desc" } });
  return rows.map(clRowToDTO);
}

export async function saveInventoryChecklist(db: ScopedDb, cl: InventoryChecklist): Promise<InventoryChecklist> {
  const exists = await db.checklistRun.findUnique({ where: { id: cl.id } });
  const data = {
    id: cl.id, templateId: "", templateName: cl.type === "pre-service" ? "Pre-Service Inventory" : "Post-Service Inventory",
    type: cl.type, businessDate: cl.businessDate, status: cl.status,
    items: cl.lines as Row, startedAt: new Date(cl.startedAt),
    startedByStaffId: "", startedByStaffName: "",
    completedAt: cl.completedAt ? new Date(cl.completedAt) : undefined,
  };
  if (exists) await db.checklistRun.update({ where: { id: cl.id }, data: { status: cl.status, items: cl.lines as Row, completedAt: cl.completedAt ? new Date(cl.completedAt) : undefined } });
  else await db.checklistRun.create({ data } as Row);
  return cl;
}

// ── Event run sheets (OE-19) ─────────────────────────────────────────

export async function getEventRunSheet(db: ScopedDb, eventId: string): Promise<{ eventId: string; entries: Row[] }> {
  const row = await db.eventRunSheet.findUnique({ where: { eventId } });
  return { eventId, entries: (row as Row)?.entries ?? [] };
}

export async function saveEventRunSheet(
  db: ScopedDb,
  venueId: string,
  eventId: string,
  entries: Row[],
): Promise<void> {
  const existing = await db.eventRunSheet.findUnique({ where: { eventId } });
  if (existing) {
    await db.eventRunSheet.update({ where: { eventId }, data: { entries: entries as Row } });
  } else {
    await db.eventRunSheet.create({ data: { venueId, eventId, entries: entries as Row } } as Row);
  }
}

// Re-export unused import to suppress warning
export type { Supplier, SupplierItem, PurchaseOrder, Stocktake, EightySixEntry, EventCost, InventoryChecklist };
