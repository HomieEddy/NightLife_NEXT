import { z } from "zod";

// ── Categories ─────────────────────────────────────────────────────────

// ── Items ──────────────────────────────────────────────────────────────

const zModifierOption = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  priceDelta: z.number(),
  maxQuantity: z.number().int().positive(),
  inventoryItemId: z.string().min(1).optional(),
  isActive: z.boolean(),
});

const zModifierGroup = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(["washer", "presentation"]),
  required: z.boolean(),
  maxSelections: z.number().int().positive(),
  isActive: z.boolean(),
  options: z.array(zModifierOption),
});

export const zCategoryInput = z.object({
  name: z.string().min(1),
  description: z.string(),
  sortOrder: z.number().int().nonnegative(),
  isActive: z.boolean().optional(),
  modifierGroups: z.array(zModifierGroup).optional(),
});

export const zCategoryPatch = zCategoryInput.partial();

export const zItemInput = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  priceCents: z.number().int().nonnegative(),
  icon: z.string().min(1),
  tags: z.array(z.string()),
  isAvailable: z.boolean().optional(),
  inventory: z.number().int().nonnegative().optional(),
  // Responsible service (plan 17): drives the alcoholic drink counter, so it
  // is a property of the item, not a display hint.
  isAlcoholic: z.boolean().optional(),
  abv: z.number().nonnegative().max(100).optional(),
  allergens: z.array(z.string()).optional(),
});

export const zItemPatch = z.object({
  categoryId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  priceCents: z.number().int().nonnegative().optional(),
  icon: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  isAvailable: z.boolean().optional(),
  isAlcoholic: z.boolean().optional(),
  abv: z.number().nonnegative().max(100).nullable().optional(),
  allergens: z.array(z.string()).optional(),
});

// ── Inventory ──────────────────────────────────────────────────────────

export const zRestock = z.object({
  quantity: z.number().int().positive(),
  note: z.string().optional(),
});

export const zAdjust = z.object({
  newCount: z.number().int().nonnegative(),
  note: z.string().optional(),
});

export const zBulkRestock = z.object({
  lines: z.array(z.object({
    itemId: z.string().min(1),
    quantity: z.number().int().positive(),
  })).min(1),
  note: z.string().optional(),
});

export const zRecordSale = z.object({
  lines: z.array(z.object({
    menuItemId: z.string().min(1),
    quantity: z.number().int().positive(),
  })).min(1),
});

// ── Packages ───────────────────────────────────────────────────────────

const zComponentInput = z.object({
  menuItemId: z.string().min(1),
  quantity: z.number().int().positive(),
});

export const zPackageInput = z.object({
  name: z.string().min(1),
  description: z.string(),
  priceCents: z.number().int().nonnegative(),
  components: z.array(zComponentInput).min(1),
  isActive: z.boolean().optional(),
  modifierGroups: z.array(zModifierGroup).optional(),
});

export const zPackagePatch = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  priceCents: z.number().int().nonnegative().optional(),
  components: z.array(zComponentInput).min(1).optional(),
  isActive: z.boolean().optional(),
  modifierGroups: z.array(zModifierGroup).optional(),
});

// ── Happy hour ─────────────────────────────────────────────────────────

export const zHappyHourInput = z.object({
  name: z.string().min(1),
  daysOfWeek: z.array(z.number().int().min(0).max(6)),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  discountPct: z.number().int().min(1).max(100),
  appliesToCategoryIds: z.array(z.string()),
  isActive: z.boolean().optional(),
});

export const zHappyHourPatch = zHappyHourInput.partial();
