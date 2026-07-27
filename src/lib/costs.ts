import type {
  MenuItem,
  StockMovement,
  PurchaseOrder,
  SupplierItem,
  EventPnL,
  EventCost,
  StocktakeLine,
} from "./types";

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
