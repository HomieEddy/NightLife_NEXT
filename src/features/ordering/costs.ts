import type { MenuItem, PurchaseOrder, SupplierItem } from "@/lib/types";

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
