/**
 * Menu, inventory & package logic used by route handlers.
 * Ledger discipline (INV-I1): every inventory write = movement row + cached
 * balance in the same transaction. recordSale uses SELECT FOR UPDATE to
 * prevent oversell under concurrency.
 */
import type { getDb } from "@/features/shared/db";
import { getRawPrisma } from "@/features/shared/db";
import { fromCents } from "@/features/shared/money";
import type {
  BottlePackage,
  HappyHourRule,
  MenuCategory,
  MenuItem,
  ModifierGroup,
  PackageQuote,
  SoldOutEvent,
  StockMovement,
  StockMovementType,
} from "@/lib/types";
import type { z } from "zod";
import type {
  zCategoryInput,
  zCategoryPatch,
  zItemInput,
  zItemPatch,
  zRestock,
  zAdjust,
  zBulkRestock,
  zRecordSale,
  zPackageInput,
  zPackagePatch,
  zHappyHourInput,
  zHappyHourPatch,
} from "@/features/menu/schemas";

type ScopedDb = ReturnType<typeof getDb>;

// ── Row → domain mappers ───────────────────────────────────────────────

function toCategory(row: {
  id: string;
  venueId: string;
  name: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  modifierGroups: unknown;
}): MenuCategory {
  return {
    id: row.id,
    venueId: row.venueId,
    name: row.name,
    description: row.description,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    modifierGroups: row.modifierGroups as ModifierGroup[],
  };
}

function toItem(row: {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  priceCents: number;
  icon: string;
  tags: string[];
  isAvailable: boolean;
  inventory: number;
}): MenuItem {
  return {
    id: row.id,
    categoryId: row.categoryId,
    name: row.name,
    description: row.description,
    price: fromCents(row.priceCents),
    icon: row.icon as MenuItem["icon"],
    tags: row.tags as MenuItem["tags"],
    isAvailable: row.isAvailable,
    inventory: row.inventory,
    // TODO(backend): plan 17 graduation — add isAlcoholic/abv/allergens columns;
    // responsible-service drink counting is demo-track only until then.
    isAlcoholic: false,
    allergens: [],
  };
}

function toMovement(row: {
  id: string;
  menuItemId: string;
  itemName: string;
  type: string;
  delta: number;
  note: string | null;
  createdAt: Date;
}): StockMovement {
  return {
    id: row.id,
    menuItemId: row.menuItemId,
    itemName: row.itemName,
    type: row.type as StockMovementType,
    delta: row.delta,
    note: row.note ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

function toSoldOutEvent(row: {
  id: string;
  itemId: string;
  itemName: string;
  at: Date;
}): SoldOutEvent {
  return {
    id: row.id,
    itemId: row.itemId,
    itemName: row.itemName,
    at: row.at.toISOString(),
  };
}

function toPackage(row: {
  id: string;
  venueId: string;
  name: string;
  description: string;
  priceCents: number;
  isActive: boolean;
  components: { itemId: string; quantity: number }[];
  modifierGroups: unknown;
}): BottlePackage {
  return {
    id: row.id,
    venueId: row.venueId,
    name: row.name,
    description: row.description,
    price: fromCents(row.priceCents),
    components: row.components.map((c) => ({
      menuItemId: c.itemId,
      quantity: c.quantity,
    })),
    modifierGroups: row.modifierGroups as ModifierGroup[],
    isActive: row.isActive,
  };
}

function toHappyHourRule(row: {
  id: string;
  venueId: string;
  name: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  discountPct: number;
  appliesToCategoryIds: string[];
  isActive: boolean;
}): HappyHourRule {
  return {
    id: row.id,
    venueId: row.venueId,
    name: row.name,
    daysOfWeek: row.daysOfWeek,
    startTime: row.startTime,
    endTime: row.endTime,
    discountPct: row.discountPct,
    appliesToCategoryIds: row.appliesToCategoryIds,
    isActive: row.isActive,
  };
}

// ── Categories ─────────────────────────────────────────────────────────

export async function listCategories(
  db: ScopedDb,
  includeInactive = false,
): Promise<MenuCategory[]> {
  const rows = await db.menuCategory.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map(toCategory);
}

export async function createCategory(
  db: ScopedDb,
  venueId: string,
  input: z.infer<typeof zCategoryInput>,
): Promise<MenuCategory> {
  const row = await db.menuCategory.create({
    data: {
      ...input,
      modifierGroups: (input.modifierGroups ?? []) as unknown as object,
      venueId,
    },
  });
  return toCategory(row);
}

export async function updateCategory(
  db: ScopedDb,
  categoryId: string,
  patch: z.infer<typeof zCategoryPatch>,
): Promise<MenuCategory | null> {
  const row = await db.menuCategory
    .update({
      where: { id: categoryId },
      data: {
        ...patch,
        modifierGroups: patch.modifierGroups as unknown as object,
      },
    })
    .catch(() => null);
  return row ? toCategory(row) : null;
}

export async function toggleCategory(
  db: ScopedDb,
  categoryId: string,
): Promise<MenuCategory | null> {
  const existing = await db.menuCategory.findUnique({ where: { id: categoryId } });
  if (!existing) return null;
  const row = await db.menuCategory.update({
    where: { id: categoryId },
    data: { isActive: !existing.isActive },
  });
  return toCategory(row);
}

export async function deleteCategory(db: ScopedDb, categoryId: string): Promise<boolean> {
  if (await db.menuItem.findFirst({ where: { categoryId } })) return false;
  return db.menuCategory.delete({ where: { id: categoryId } })
    .then(() => true)
    .catch(() => false);
}

// ── Items ──────────────────────────────────────────────────────────────

export async function listItems(
  db: ScopedDb,
  categoryId?: string,
): Promise<MenuItem[]> {
  const rows = await db.menuItem.findMany({
    where: categoryId ? { categoryId } : undefined,
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toItem);
}

export async function getItem(
  db: ScopedDb,
  itemId: string,
): Promise<MenuItem | null> {
  const row = await db.menuItem.findUnique({ where: { id: itemId } });
  return row ? toItem(row) : null;
}

export async function createItem(
  db: ScopedDb,
  venueId: string,
  input: z.infer<typeof zItemInput>,
): Promise<MenuItem> {
  const initialStock = input.inventory ?? 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = await (db as any).$transaction(async (tx: any) => {
    const item = await tx.menuItem.create({
      data: {
        venueId,
        categoryId: input.categoryId,
        name: input.name,
        description: input.description,
        priceCents: input.priceCents,
        icon: input.icon,
        tags: input.tags,
        isAvailable: input.isAvailable ?? true,
        inventory: initialStock,
      },
    });
    if (initialStock > 0) {
      await tx.stockMovement.create({
        data: {
          venueId,
          menuItemId: item.id,
          itemName: item.name,
          type: "restock",
          delta: initialStock,
          note: "Initial stock",
        },
      });
    }
    return item;
  });
  return toItem(row);
}

export async function updateItem(
  db: ScopedDb,
  venueId: string,
  itemId: string,
  patch: z.infer<typeof zItemPatch>,
): Promise<MenuItem | null> {
  const existing = await db.menuItem.findUnique({ where: { id: itemId } });
  if (!existing) return null;

  const data: Record<string, unknown> = {};
  if (patch.categoryId !== undefined) data.categoryId = patch.categoryId;
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.description !== undefined) data.description = patch.description;
  if (patch.priceCents !== undefined) data.priceCents = patch.priceCents;
  if (patch.icon !== undefined) data.icon = patch.icon;
  if (patch.tags !== undefined) data.tags = patch.tags;

  if (patch.isAvailable !== undefined) {
    data.isAvailable = patch.isAvailable;
    if (!patch.isAvailable && existing.isAvailable) {
      await db.soldOutEvent.create({
        data: { venueId, itemId, itemName: existing.name },
      });
    }
  }

  const row = await db.menuItem.update({ where: { id: itemId }, data });
  return toItem(row);
}

export async function deleteItem(
  db: ScopedDb,
  itemId: string,
): Promise<{ ok: boolean; blockedBy?: string[] }> {
  const refs = await db.packageComponent.findMany({
    where: { itemId },
    include: { package: { select: { name: true, isActive: true } } },
  });
  const activeRefs = refs.filter((r) => r.package.isActive);
  if (activeRefs.length > 0) {
    return { ok: false, blockedBy: activeRefs.map((r) => r.package.name) };
  }
  await db.menuItem.delete({ where: { id: itemId } }).catch(() => undefined);
  return { ok: true };
}

// ── Inventory ──────────────────────────────────────────────────────────

export async function listMovements(
  db: ScopedDb,
  limit = 25,
): Promise<StockMovement[]> {
  const rows = await db.stockMovement.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(toMovement);
}

export async function restockItem(
  db: ScopedDb,
  venueId: string,
  itemId: string,
  input: z.infer<typeof zRestock>,
): Promise<MenuItem | null> {
  const existing = await db.menuItem.findUnique({ where: { id: itemId } });
  if (!existing) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = await (db as any).$transaction(async (tx: any) => {
    const item = await tx.menuItem.update({
      where: { id: itemId },
      data: { inventory: { increment: input.quantity } },
    });
    await tx.stockMovement.create({
      data: {
        venueId,
        menuItemId: itemId,
        itemName: item.name,
        type: "restock",
        delta: input.quantity,
        note: input.note,
      },
    });
    return item;
  });
  return toItem(row);
}

export async function bulkRestock(
  db: ScopedDb,
  venueId: string,
  input: z.infer<typeof zBulkRestock>,
): Promise<number> {
  let applied = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any).$transaction(async (tx: any) => {
    for (const line of input.lines) {
      const item = await tx.menuItem.findUnique({ where: { id: line.itemId } });
      if (!item) continue;
      await tx.menuItem.update({
        where: { id: line.itemId },
        data: { inventory: { increment: line.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          venueId,
          menuItemId: line.itemId,
          itemName: item.name,
          type: "restock",
          delta: line.quantity,
          note: input.note,
        },
      });
      applied++;
    }
  });
  return applied;
}

export async function adjustInventory(
  db: ScopedDb,
  venueId: string,
  itemId: string,
  input: z.infer<typeof zAdjust>,
): Promise<MenuItem | null> {
  const existing = await db.menuItem.findUnique({ where: { id: itemId } });
  if (!existing) return null;

  const delta = input.newCount - existing.inventory;
  if (delta === 0) return toItem(existing);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = await (db as any).$transaction(async (tx: any) => {
    const item = await tx.menuItem.update({
      where: { id: itemId },
      data: { inventory: input.newCount },
    });
    await tx.stockMovement.create({
      data: {
        venueId,
        menuItemId: itemId,
        itemName: item.name,
        type: "adjustment",
        delta,
        note: input.note,
      },
    });
    if (existing.inventory > 0 && input.newCount === 0) {
      await tx.soldOutEvent.create({
        data: { venueId, itemId, itemName: item.name },
      });
    }
    return item;
  });
  return toItem(row);
}

/**
 * Decrements inventory for sold lines with row-level locking (SELECT FOR UPDATE)
 * to prevent oversell under concurrency. Rejects if any item has insufficient stock.
 */
export async function recordSale(
  db: ScopedDb,
  venueId: string,
  input: z.infer<typeof zRecordSale>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const prisma = getRawPrisma();
  try {
    await prisma.$transaction(async (tx) => {
      for (const line of input.lines) {
        const locked = await tx.$queryRawUnsafe<{ id: string; name: string; inventory: number; is_available: boolean }[]>(
          `SELECT id, name, inventory, is_available FROM menu_items WHERE id = $1 AND venue_id = $2 FOR UPDATE`,
          line.menuItemId,
          venueId,
        );

        if (locked.length === 0) {
          throw new Error(`Item ${line.menuItemId} not found`);
        }

        const item = locked[0];
        if (!item.is_available) {
          throw new Error(`${item.name} is not available`);
        }
        if (item.inventory < line.quantity) {
          throw new Error(`Not enough stock for ${item.name} (have ${item.inventory}, need ${line.quantity})`);
        }

        const newInventory = item.inventory - line.quantity;
        await tx.$executeRawUnsafe(
          `UPDATE menu_items SET inventory = $1, updated_at = NOW() WHERE id = $2`,
          newInventory,
          item.id,
        );
        await tx.stockMovement.create({
          data: {
            venueId,
            menuItemId: item.id,
            itemName: item.name,
            type: "sale",
            delta: -line.quantity,
            note: "Guest order",
          },
        });

        if (item.inventory > 0 && newInventory === 0) {
          await tx.soldOutEvent.create({
            data: { venueId, itemId: item.id, itemName: item.name },
          });
        }
      }
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ── Sold-out events ────────────────────────────────────────────────────

export async function listSoldOutEvents(
  db: ScopedDb,
  withinMinutes = 30,
): Promise<SoldOutEvent[]> {
  const cutoff = new Date(Date.now() - withinMinutes * 60_000);
  const rows = await db.soldOutEvent.findMany({
    where: { at: { gte: cutoff } },
    orderBy: { at: "desc" },
  });
  return rows.map(toSoldOutEvent);
}

// ── Packages ───────────────────────────────────────────────────────────

async function computeQuote(
  db: ScopedDb,
  pkg: BottlePackage,
): Promise<PackageQuote> {
  let componentsValue = 0;
  let maxQuantity = Number.POSITIVE_INFINITY;
  const lines: PackageQuote["lines"] = [];

  for (const component of pkg.components) {
    const item = await db.menuItem.findUnique({
      where: { id: component.menuItemId },
    });
    if (!item) {
      maxQuantity = 0;
      continue;
    }
    const unitPrice = fromCents(item.priceCents);
    componentsValue += unitPrice * component.quantity;
    const fulfillable = item.isAvailable
      ? Math.floor(item.inventory / component.quantity)
      : 0;
    maxQuantity = Math.min(maxQuantity, fulfillable);
    lines.push({
      menuItemId: item.id,
      name: item.name,
      quantity: component.quantity,
      unitPrice,
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

export async function listPackages(
  db: ScopedDb,
  includeInactive = false,
): Promise<(BottlePackage & { quote: PackageQuote })[]> {
  const rows = await db.bottlePackage.findMany({
    where: includeInactive ? undefined : { isActive: true },
    include: { components: true },
    orderBy: { createdAt: "asc" },
  });
  const result: (BottlePackage & { quote: PackageQuote })[] = [];
  for (const row of rows) {
    const pkg = toPackage(row);
    const quote = await computeQuote(db, pkg);
    result.push({ ...pkg, quote });
  }
  return result;
}

export async function getPackage(
  db: ScopedDb,
  packageId: string,
): Promise<(BottlePackage & { quote: PackageQuote }) | null> {
  const row = await db.bottlePackage.findUnique({
    where: { id: packageId },
    include: { components: true },
  });
  if (!row) return null;
  const pkg = toPackage(row);
  const quote = await computeQuote(db, pkg);
  return { ...pkg, quote };
}

export async function createPackage(
  db: ScopedDb,
  venueId: string,
  input: z.infer<typeof zPackageInput>,
): Promise<BottlePackage> {
  const row = await db.bottlePackage.create({
    data: {
      venueId,
      name: input.name,
      description: input.description,
      priceCents: input.priceCents,
      isActive: input.isActive ?? true,
      modifierGroups: (input.modifierGroups ?? []) as unknown as object,
      components: {
        create: input.components.map((c) => ({
          itemId: c.menuItemId,
          quantity: c.quantity,
        })),
      },
    },
    include: { components: true },
  });
  return toPackage(row);
}

export async function updatePackage(
  db: ScopedDb,
  packageId: string,
  patch: z.infer<typeof zPackagePatch>,
): Promise<BottlePackage | null> {
  const existing = await db.bottlePackage.findUnique({ where: { id: packageId } });
  if (!existing) return null;

  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.description !== undefined) data.description = patch.description;
  if (patch.priceCents !== undefined) data.priceCents = patch.priceCents;
  if (patch.isActive !== undefined) data.isActive = patch.isActive;
  if (patch.modifierGroups !== undefined) {
    data.modifierGroups = patch.modifierGroups as unknown as object;
  }

  if (patch.components) {
    await db.packageComponent.deleteMany({ where: { packageId } });
    data.components = {
      create: patch.components.map((c) => ({
        itemId: c.menuItemId,
        quantity: c.quantity,
      })),
    };
  }

  const row = await db.bottlePackage.update({
    where: { id: packageId },
    data,
    include: { components: true },
  });
  return toPackage(row);
}

export async function deletePackage(
  db: ScopedDb,
  packageId: string,
): Promise<void> {
  await db.bottlePackage.delete({ where: { id: packageId } }).catch(() => undefined);
}

// ── Happy hour ─────────────────────────────────────────────────────────

export async function listHappyHourRules(
  db: ScopedDb,
): Promise<HappyHourRule[]> {
  const rows = await db.happyHourRule.findMany({
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toHappyHourRule);
}

export async function createHappyHourRule(
  db: ScopedDb,
  venueId: string,
  input: z.infer<typeof zHappyHourInput>,
): Promise<HappyHourRule> {
  const row = await db.happyHourRule.create({
    data: { ...input, venueId },
  });
  return toHappyHourRule(row);
}

export async function updateHappyHourRule(
  db: ScopedDb,
  ruleId: string,
  patch: z.infer<typeof zHappyHourPatch>,
): Promise<HappyHourRule | null> {
  const row = await db.happyHourRule
    .update({ where: { id: ruleId }, data: patch })
    .catch(() => null);
  return row ? toHappyHourRule(row) : null;
}

export async function toggleHappyHourRule(
  db: ScopedDb,
  ruleId: string,
): Promise<HappyHourRule | null> {
  const existing = await db.happyHourRule.findUnique({ where: { id: ruleId } });
  if (!existing) return null;
  const row = await db.happyHourRule.update({
    where: { id: ruleId },
    data: { isActive: !existing.isActive },
  });
  return toHappyHourRule(row);
}

export async function deleteHappyHourRule(
  db: ScopedDb,
  ruleId: string,
): Promise<void> {
  await db.happyHourRule.delete({ where: { id: ruleId } }).catch(() => undefined);
}

// ── Ledger check (test helper, exported for integration tests) ─────────

export async function checkLedger(
  db: ScopedDb,
  itemId: string,
): Promise<{ balanced: boolean; inventory: number; movementSum: number }> {
  const item = await db.menuItem.findUnique({ where: { id: itemId } });
  if (!item) return { balanced: false, inventory: 0, movementSum: 0 };

  const result = await db.stockMovement.aggregate({
    where: { menuItemId: itemId },
    _sum: { delta: true },
  });
  const movementSum = result._sum.delta ?? 0;
  return {
    balanced: item.inventory === movementSum,
    inventory: item.inventory,
    movementSum,
  };
}
