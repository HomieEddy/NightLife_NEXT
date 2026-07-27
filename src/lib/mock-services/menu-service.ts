/**
 * Permanent demo implementation of menu, package and inventory management.
 * Live mode persists the same service contract and uses a stock ledger.
 */
import type {
  BottlePackage,
  HappyHourRule,
  MenuCategory,
  MenuItem,
  PackageComponent,
  PackageQuote,
  SoldOutEvent,
  StockMovement,
  StockMovementType,
} from "@/lib/types";
import {
  mockCategories,
  mockHappyHourRules,
  mockMenuItems,
  mockPackages,
  mockStockMovements,
} from "@/lib/mock-data/menu";
import { clone, delay, uid } from "./delay";

let categories: MenuCategory[] = clone(mockCategories);
let items: MenuItem[] = clone(mockMenuItems);
let packages: BottlePackage[] = clone(mockPackages);
let happyHourRules: HappyHourRule[] = clone(mockHappyHourRules);
let movements: StockMovement[] = clone(mockStockMovements);
let soldOutEvents: SoldOutEvent[] = [];

function logMovement(
  item: MenuItem,
  type: StockMovementType,
  delta: number,
  note?: string,
  voidAdjustmentId?: string,
) {
  movements = [
    {
      id: uid("mv"),
      menuItemId: item.id,
      itemName: item.name,
      type,
      delta,
      note,
      createdAt: new Date().toISOString(),
      voidAdjustmentId,
    },
    ...movements,
  ];
}

/** Feeds the live 86-board — every staff device sees this within one poll. */
function flagSoldOut(item: MenuItem) {
  soldOutEvents = [
    { id: uid("so"), itemId: item.id, itemName: item.name, at: new Date().toISOString() },
    ...soldOutEvents,
  ].slice(0, 20);
}

function quoteFor(pkg: BottlePackage): PackageQuote {
  let componentsValue = 0;
  let maxQuantity = Number.POSITIVE_INFINITY;
  const lines: PackageQuote["lines"] = [];
  for (const component of pkg.components) {
    const item = items.find((i) => i.id === component.menuItemId);
    if (!item) {
      maxQuantity = 0;
      continue;
    }
    componentsValue += item.price * component.quantity;
    const fulfillable = item.isAvailable
      ? Math.floor(item.inventory / component.quantity)
      : 0;
    maxQuantity = Math.min(maxQuantity, fulfillable);
    lines.push({
      menuItemId: item.id,
      name: item.name,
      quantity: component.quantity,
      unitPrice: item.price,
    });
  }
  if (!Number.isFinite(maxQuantity)) maxQuantity = 0;
  return {
    componentsValue,
    savings: Math.max(0, componentsValue - pkg.price),
    maxQuantity,
    lines,
  };
}

export const mockMenuService = {
  async listCategories(includeInactive = false): Promise<MenuCategory[]> {
    await delay();
    const result = includeInactive ? categories : categories.filter((c) => c.isActive);
    return clone(result).sort((a, b) => a.sortOrder - b.sortOrder);
  },

  async createCategory(input: Omit<MenuCategory, "id">): Promise<MenuCategory> {
    await delay(500);
    const category: MenuCategory = { id: uid("cat"), ...input };
    categories = [...categories, category];
    return clone(category);
  },

  async updateCategory(
    categoryId: string,
    patch: Partial<Omit<MenuCategory, "id" | "venueId">>,
  ): Promise<MenuCategory | null> {
    await delay(400);
    const category = categories.find((entry) => entry.id === categoryId);
    if (!category) return null;
    Object.assign(category, patch);
    return clone(category);
  },

  async deleteCategory(categoryId: string): Promise<void> {
    await delay(400);
    if (items.some((item) => item.categoryId === categoryId)) {
      throw new Error("Category still has menu items");
    }
    categories = categories.filter((category) => category.id !== categoryId);
  },

  async listItems(categoryId?: string): Promise<MenuItem[]> {
    await delay();
    const result = categoryId ? items.filter((i) => i.categoryId === categoryId) : items;
    return clone(result);
  },

  async getItem(itemId: string): Promise<MenuItem | null> {
    await delay(200);
    return clone(items.find((i) => i.id === itemId) ?? null);
  },

  async updateItem(itemId: string, patch: Partial<Omit<MenuItem, "id">>): Promise<MenuItem | null> {
    await delay(400);
    const item = items.find((i) => i.id === itemId);
    if (!item) return null;
    const wasAvailable = item.isAvailable;
    Object.assign(item, patch);
    if (patch.isAvailable === false && wasAvailable) flagSoldOut(item);
    return clone(item);
  },

  async createItem(input: Omit<MenuItem, "id">): Promise<MenuItem> {
    await delay(500);
    const item: MenuItem = { id: uid("mi"), ...input };
    items = [...items, item];
    if (item.inventory > 0) logMovement(item, "restock", item.inventory, "Initial stock");
    return clone(item);
  },

  async deleteItem(itemId: string): Promise<void> {
    await delay(400);
    items = items.filter((i) => i.id !== itemId);
  },

  async toggleCategory(categoryId: string): Promise<MenuCategory | null> {
    await delay(300);
    const category = categories.find((c) => c.id === categoryId);
    if (!category) return null;
    category.isActive = !category.isActive;
    return clone(category);
  },

  // ---------- Packages ----------

  async listPackages(includeInactive = false): Promise<(BottlePackage & { quote: PackageQuote })[]> {
    await delay();
    const result = includeInactive ? packages : packages.filter((p) => p.isActive);
    return result.map((pkg) => ({ ...clone(pkg), quote: quoteFor(pkg) }));
  },

  async getPackage(packageId: string): Promise<(BottlePackage & { quote: PackageQuote }) | null> {
    await delay(200);
    const pkg = packages.find((p) => p.id === packageId);
    return pkg ? { ...clone(pkg), quote: quoteFor(pkg) } : null;
  },

  async createPackage(input: Omit<BottlePackage, "id">): Promise<BottlePackage> {
    await delay(500);
    const pkg: BottlePackage = { id: uid("pkg"), ...input };
    packages = [...packages, pkg];
    return clone(pkg);
  },

  async updatePackage(
    packageId: string,
    patch: Partial<Omit<BottlePackage, "id">>,
  ): Promise<BottlePackage | null> {
    await delay(400);
    const pkg = packages.find((p) => p.id === packageId);
    if (!pkg) return null;
    Object.assign(pkg, patch);
    return clone(pkg);
  },

  async deletePackage(packageId: string): Promise<void> {
    await delay(400);
    packages = packages.filter((p) => p.id !== packageId);
  },

  // ---------- Inventory ----------
  // All stock changes flow through movements — never a raw column write.
  // Live mode persists this as an append-only stock_movements ledger.

  async listMovements(limit = 25): Promise<StockMovement[]> {
    await delay(250);
    return clone(movements).slice(0, limit);
  },

  /** Restock delivery: adds `quantity` bottles and logs a movement. */
  async restockItem(itemId: string, quantity: number, note?: string): Promise<MenuItem | null> {
    await delay(400);
    const item = items.find((i) => i.id === itemId);
    if (!item || quantity <= 0) return null;
    item.inventory += quantity;
    logMovement(item, "restock", quantity, note);
    return clone(item);
  },

  /** One delivery, many items: applies every line and logs one movement each. */
  async bulkRestock(
    lines: { itemId: string; quantity: number }[],
    note?: string,
  ): Promise<number> {
    await delay(600);
    let applied = 0;
    for (const line of lines) {
      const item = items.find((i) => i.id === line.itemId);
      if (!item || line.quantity <= 0) continue;
      item.inventory += line.quantity;
      logMovement(item, "restock", line.quantity, note);
      applied++;
    }
    return applied;
  },

  /** Manual correction: sets the exact count, logging the delta as an adjustment. */
  async adjustInventory(itemId: string, newCount: number, note?: string): Promise<MenuItem | null> {
    await delay(400);
    const item = items.find((i) => i.id === itemId);
    if (!item || newCount < 0) return null;
    const delta = newCount - item.inventory;
    if (delta !== 0) {
      const wasPositive = item.inventory > 0;
      item.inventory = newCount;
      logMovement(item, "adjustment", delta, note);
      if (wasPositive && newCount === 0) flagSoldOut(item);
    }
    return clone(item);
  },

  /**
   * Decrements inventory for sold lines. Package lines (pkg-*) decrement each
   * component. Live mode performs the same draw-down transactionally with row locks.
   */
  async recordSale(lines: { menuItemId: string; quantity: number }[]): Promise<void> {
    for (const line of lines) {
      const pkg = packages.find((p) => p.id === line.menuItemId);
      const components: PackageComponent[] = pkg
        ? pkg.components.map((c) => ({ ...c, quantity: c.quantity * line.quantity }))
        : [{ menuItemId: line.menuItemId, quantity: line.quantity }];
      for (const component of components) {
        const item = items.find((i) => i.id === component.menuItemId);
        if (!item) continue;
        const wasPositive = item.inventory > 0;
        const sold = Math.min(item.inventory, component.quantity);
        item.inventory -= sold;
        logMovement(item, "sale", -sold, pkg ? `Package: ${pkg.name}` : "Guest order");
        if (wasPositive && item.inventory === 0) flagSoldOut(item);
      }
    }
  },

  /** Recent sell-outs and manual 86s — the live 86-board every staff device polls. */
  async listSoldOutEvents(withinMinutes = 30): Promise<SoldOutEvent[]> {
    await delay(200);
    const cutoff = Date.now() - withinMinutes * 60_000;
    return clone(soldOutEvents.filter((e) => new Date(e.at).getTime() >= cutoff));
  },

  // ---------- Happy hour ----------

  async listHappyHourRules(): Promise<HappyHourRule[]> {
    await delay();
    return clone(happyHourRules);
  },

  async toggleHappyHourRule(ruleId: string): Promise<HappyHourRule | null> {
    await delay(300);
    const rule = happyHourRules.find((r) => r.id === ruleId);
    if (!rule) return null;
    rule.isActive = !rule.isActive;
    return clone(rule);
  },

  async createHappyHourRule(input: Omit<HappyHourRule, "id" | "venueId">): Promise<HappyHourRule> {
    await delay(500);
    const rule: HappyHourRule = { id: uid("hh"), venueId: "venue-1", ...input };
    happyHourRules = [...happyHourRules, rule];
    return clone(rule);
  },

  async updateHappyHourRule(
    ruleId: string,
    patch: Partial<Omit<HappyHourRule, "id" | "venueId">>,
  ): Promise<HappyHourRule | null> {
    await delay(400);
    const rule = happyHourRules.find((r) => r.id === ruleId);
    if (!rule) return null;
    Object.assign(rule, patch);
    return clone(rule);
  },

  async deleteHappyHourRule(ruleId: string): Promise<void> {
    await delay(400);
    happyHourRules = happyHourRules.filter((r) => r.id !== ruleId);
  },
};

/**
 * Demo-track internal (not part of the cross-track service contract — the live
 * order core reverses its own ledger rows): credits a cancelled order's draw-down
 * back as adjustment movements, with recordSale's package expansion. May over-credit
 * if the original draw-down was clamped at zero stock; acceptable in the sandbox.
 */
export async function restoreSale(
  lines: { menuItemId: string; quantity: number }[],
  note = "Order cancelled",
  /** Set when this restock is a void's stock-return side (plan 16, INV-T2) — tags the movement row. */
  voidAdjustmentId?: string,
): Promise<void> {
  for (const line of lines) {
    const pkg = packages.find((p) => p.id === line.menuItemId);
    const components: PackageComponent[] = pkg
      ? pkg.components.map((c) => ({ ...c, quantity: c.quantity * line.quantity }))
      : [{ menuItemId: line.menuItemId, quantity: line.quantity }];
    for (const component of components) {
      const item = items.find((i) => i.id === component.menuItemId);
      if (!item) continue;
      item.inventory += component.quantity;
      logMovement(item, "adjustment", component.quantity, note, voidAdjustmentId);
    }
  }
}
