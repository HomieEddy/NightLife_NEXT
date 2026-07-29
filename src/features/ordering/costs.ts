import type {
  MenuItem,
  StockMovement,
  PurchaseOrder,
  SupplierItem,
  EventPnL,
  EventCost,
  StocktakeLine,
} from "@/lib/types";

/**
 * Recompute the weighted average unit cost for an item from its inbound
 * restock movements. Consumption values at WAC, recomputed on each receipt.
 */
export function weightedAverageCost(itemId: string, movements: StockMovement[]): number {
  let totalCost = 0;
  let totalQty = 0;
  for (const m of movements) {
    if (m.menuItemId !== itemId) continue;
    if (m.type !== "restock" || m.delta <= 0 || m.unitCostCents == null) continue;
    totalCost += m.delta * m.unitCostCents;
    totalQty += m.delta;
  }
  if (totalQty <= 0) return 0;
  return Math.round(totalCost / totalQty);
}

/**
 * Pour cost = COGS ÷ net revenue. COGS = Σ (quantity sold × avgCostCents at time
 * of sale) — here approximated as the current avgCostCents × units sold.
 * Returns a ratio 0–1+ (e.g. 0.22 = 22%).
 */
 export function computePourCost(
  netRevenueCents: number,
  itemsSold: { menuItemId: string; quantity: number; avgCostCents?: number }[],
): number {
  if (netRevenueCents <= 0) return 0;
  const cogs = itemsSold.reduce((sum, i) => sum + (i.avgCostCents ?? 0) * i.quantity, 0);
  return cogs / netRevenueCents;
}

/** Total variance in cents for a stocktake line. */
export function computeVariance(
  line: StocktakeLine,
): { varianceQty: number; varianceCents: number } {
  const counted = line.countedQty ?? line.secondCountQty ?? 0;
  const varianceQty = counted - line.expectedQty;
  // varianceCents is already set by the caller using avgCostCents at commit time
  return { varianceQty, varianceCents: line.varianceCents };
}

/**
 * Resolve the par level for an item on a given day of week.
 * Returns null if no par level is configured for that day.
 */
export function parForDate(item: MenuItem, dayOfWeek: number): number | null {
  return item.parLevels?.[dayOfWeek] ?? null;
}

/**
 * Generate suggested purchase order lines — items where current inventory +
 * open PO quantities < par for the `targetDow`.
 */
export function suggestPurchaseOrder(
  items: MenuItem[],
  openPos: PurchaseOrder[],
  targetDayOfWeek: number,
  supplierItems: SupplierItem[],
  supplierId: string,
): { menuItemId: string; itemName: string; suggestedQty: number; unitCostCents: number | null; supplierSku?: string }[] {
  const suggestions: {
    menuItemId: string;
    itemName: string;
    suggestedQty: number;
    unitCostCents: number | null;
    supplierSku?: string;
  }[] = [];

  for (const item of items) {
    const par = parForDate(item, targetDayOfWeek);
    if (par == null) continue;

    const onOrder = openPos
      .filter((po) => po.supplierId === supplierId && po.status !== "cancelled" && po.status !== "received")
      .flatMap((po) => po.lines)
      .filter((l) => l.menuItemId === item.id)
      .reduce((sum, l) => sum + (l.qtyOrdered - l.qtyReceived), 0);

    const needed = par - item.inventory - onOrder;
    if (needed <= 0) continue;

    const si = supplierItems.find((s) => s.menuItemId === item.id && s.supplierId === supplierId);
    suggestions.push({
      menuItemId: item.id,
      itemName: item.name,
      suggestedQty: Math.max(1, needed),
      unitCostCents: si?.unitCostCents ?? null,
      supplierSku: si?.supplierSku,
    });
  }
  return suggestions;
}

/** Compute event profitability from attributed revenue, product cost, labour cost and event costs. */
export function computeEventPnL(
  eventId: string,
  eventName: string,
  attributedRevenue: number,
  attributedProductCost: number,
  attributedLabourCost: number,
  eventCosts: EventCost[],
): EventPnL {
  const totalCosts = attributedProductCost + attributedLabourCost + eventCosts.reduce((s, c) => s + c.amountCents, 0);
  return {
    eventId,
    eventName,
    attributedRevenue,
    attributedProductCost,
    attributedLabourCost,
    eventCosts,
    totalCosts,
    contribution: attributedRevenue - totalCosts,
  };
}

/** CRM-04: Computes guest spend by category from delivered orders. */
export function computeGuestSpendByCategory(
  orders: { orderId: string; menuItemId: string; categoryId: string; priceCents: number; status: string; deliveredAt: string }[],
): Record<string, { totalCents: number; count: number }> {
  const byCat: Record<string, { totalCents: number; count: number }> = {};
  for (const o of orders) {
    if (o.status !== "delivered") continue;
    const cat = byCat[o.categoryId] ?? { totalCents: 0, count: 0 };
    cat.totalCents += o.priceCents;
    cat.count += 1;
    byCat[o.categoryId] = cat;
  }
  return byCat;
}

/** OE-02: Estimates drink preparation time based on queue position. */
export function estimateDrinkEta(
  queuePosition: number,
  avgPrepMinutes: number,
  startedAt?: string,
): number {
  const elapsed = startedAt ? (Date.now() - new Date(startedAt).getTime()) / 60000 : 0;
  return Math.max(0, Math.round(queuePosition * avgPrepMinutes - elapsed));
}

/** OE-28: Computes staff performance metrics from orders. */
export function computeStaffPerformanceMetrics(
  staffId: string,
  businessDate: string,
  orders: { staffId: string; status: string; total: number; placedAt: string; deliveredAt?: string; hasComp: boolean; compCents: number }[],
): { ordersFulfilled: number; revenueCents: number; avgMinutesToDeliver: number; compCount: number; compCents: number } {
  const delivered = orders.filter((o) => o.staffId === staffId && o.status === "delivered");
  const comps = delivered.filter((o) => o.hasComp);
  const deliveryTimes = delivered
    .filter((o) => o.deliveredAt)
    .map((o) => (new Date(o.deliveredAt!).getTime() - new Date(o.placedAt).getTime()) / 60000);
  return {
    ordersFulfilled: delivered.length,
    revenueCents: delivered.reduce((s, o) => s + o.total, 0),
    avgMinutesToDeliver: deliveryTimes.length ? Math.round(deliveryTimes.reduce((s, t) => s + t, 0) / deliveryTimes.length) : 0,
    compCount: comps.length,
    compCents: comps.reduce((s, o) => s + o.compCents, 0),
  };
}

/** CRM-05: Analyzes guest visit cadence from admission dates. */
export function analyzeVisitCadence(
  visitDates: string[],
): { avgDaysBetweenVisits: number; last30Days: number; last90Days: number; isDormant: boolean; streak: number } {
  const sorted = visitDates.map((d) => new Date(d)).sort((a, b) => a.getTime() - b.getTime());
  const now = Date.now();
  const last30 = sorted.filter((d) => (now - d.getTime()) / 86400000 <= 30).length;
  const last90 = sorted.filter((d) => (now - d.getTime()) / 86400000 <= 90).length;
  let gaps = 0;
  for (let i = 1; i < sorted.length; i++) {
    gaps += (sorted[i].getTime() - sorted[i - 1].getTime()) / 86400000;
  }
  const avg = sorted.length > 1 ? Math.round(gaps / (sorted.length - 1)) : 0;
  // Streak: count consecutive weeks going backwards from most recent visit
  let streak = 0;
  if (sorted.length > 0) {
    const latest = sorted[sorted.length - 1];
    let cursor = latest;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const diff = (cursor.getTime() - sorted[i].getTime()) / 86400000;
      if (diff <= 7) { streak++; cursor = sorted[i]; }
      else break;
    }
  }
  return { avgDaysBetweenVisits: avg, last30Days: last30, last90Days: last90, isDormant: last90 === 0, streak };
}

/** RV-04: Computes the applicable cover price for this admission time. */
export function getApplicableCoverPrice(
  rules: { daysOfWeek: number[]; startTime: string; endTime: string; coverCents: number }[],
  admissionTime: Date,
  eventId?: string,
): number {
  const day = admissionTime.getDay();
  const time = `${admissionTime.getHours().toString().padStart(2, "0")}:${admissionTime.getMinutes().toString().padStart(2, "0")}`;
  for (const rule of rules) {
    if (!rule.daysOfWeek.includes(day)) continue;
    if (time >= rule.startTime && time < rule.endTime) return rule.coverCents;
  }
  return 0;
}

/** OE-17: Checks whether adding a guest list entry would exceed the event's capacity allocation. */
export function checkGuestListCapacity(
  currentEntries: number,
  eventCapacity: number,
  perPromoterAllocation: Record<string, number>,
  promoterId?: string,
): { allowed: boolean; currentCount: number; limit: number } {
  if (promoterId && perPromoterAllocation[promoterId] != null) {
    const limit = perPromoterAllocation[promoterId];
    return { allowed: currentEntries < limit, currentCount: currentEntries, limit };
  }
  return { allowed: currentEntries < eventCapacity, currentCount: currentEntries, limit: eventCapacity };
}

/** OE-18: Parses CSV guest list data. Returns parsed entries with validation errors. */
export function parseGuestListCsv(
  csv: string,
): { entries: { name: string; email?: string; phone?: string; plusOnes: number }[]; errors: string[] } {
  const lines = csv.trim().split("\n");
  const errors: string[] = [];
  const entries: { name: string; email?: string; phone?: string; plusOnes: number }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const name = cols[0];
    if (!name) { errors.push(`Row ${i}: missing name`); continue; }
    const plusOnes = parseInt(cols[3] ?? "0") || 0;
    entries.push({ name, email: cols[1] || undefined, phone: cols[2] || undefined, plusOnes });
  }
  return { entries, errors };
}
export function computeOrderPriority(
  zoneName: string,
  minimumSpendCents: number | undefined,
  sessionCreatedAt: string,
  orderItemCount: number,
): number {
  const zoneWeights: Record<string, number> = { VIP: 10, "Main floor": 5, Rooftop: 7, Lounge: 4 };
  let score = zoneWeights[zoneName] ?? 3;
  if (minimumSpendCents) score += Math.round(minimumSpendCents / 5000);
  const sessionAgeMinutes = (Date.now() - new Date(sessionCreatedAt).getTime()) / 60000;
  score += Math.round(sessionAgeMinutes / 30);
  score += orderItemCount * 2;
  return Math.max(1, score);
}
