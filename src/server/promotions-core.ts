/**
 * Promotions lifecycle: CRUD + validateCode + status derivation from dates.
 * No stored status column — active/scheduled/expired is computed from
 * startsAt/endsAt relative to now.
 */
import type { getDb } from "./db";
import type { Promotion, PromotionStatus, PromotionType } from "@/lib/types";
import type { z } from "zod";
import type { zPromotionInput, zPromotionPatch } from "./schemas/promotions";

type ScopedDb = ReturnType<typeof getDb>;

/** Derive status from date window — the only source of truth for promotion status. */
export function derivePromotionStatus(startsAt: Date, endsAt: Date, now = new Date()): PromotionStatus {
  if (now < startsAt) return "scheduled";
  if (now > endsAt) return "expired";
  return "active";
}

function toPromotion(row: {
  id: string;
  venueId: string;
  code: string;
  name: string;
  type: string;
  value: number;
  appliesToCategoryIds: string[];
  startsAt: Date;
  endsAt: Date;
  redemptionCount: number;
}): Promotion {
  return {
    id: row.id,
    venueId: row.venueId,
    code: row.code,
    name: row.name,
    type: row.type as PromotionType,
    value: row.value,
    appliesToCategoryIds: row.appliesToCategoryIds,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    status: derivePromotionStatus(row.startsAt, row.endsAt),
    redemptionCount: row.redemptionCount,
  };
}

export async function listPromotions(db: ScopedDb): Promise<Promotion[]> {
  const rows = await db.promotion.findMany({ orderBy: { startsAt: "asc" } });
  return rows.map(toPromotion);
}

export async function getPromotion(
  db: ScopedDb,
  id: string,
): Promise<Promotion | null> {
  const row = await db.promotion.findUnique({ where: { id } });
  return row ? toPromotion(row) : null;
}

export async function createPromotion(
  db: ScopedDb,
  venueId: string,
  input: z.infer<typeof zPromotionInput>,
): Promise<Promotion> {
  const row = await db.promotion.create({
    data: {
      venueId,
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      type: input.type,
      value: input.value,
      appliesToCategoryIds: input.appliesToCategoryIds,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      redemptionCount: 0,
    },
  });
  return toPromotion(row);
}

export async function updatePromotion(
  db: ScopedDb,
  id: string,
  patch: z.infer<typeof zPromotionPatch>,
): Promise<Promotion | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (patch.code !== undefined) data.code = patch.code.trim().toUpperCase();
  if (patch.name !== undefined) data.name = patch.name.trim();
  if (patch.type !== undefined) data.type = patch.type;
  if (patch.value !== undefined) data.value = patch.value;
  if (patch.appliesToCategoryIds !== undefined) data.appliesToCategoryIds = patch.appliesToCategoryIds;
  if (patch.startsAt !== undefined) data.startsAt = new Date(patch.startsAt);
  if (patch.endsAt !== undefined) data.endsAt = new Date(patch.endsAt);

  const row = await db.promotion.update({ where: { id }, data }).catch(() => null);
  return row ? toPromotion(row) : null;
}

export async function deletePromotion(
  db: ScopedDb,
  id: string,
): Promise<void> {
  await db.promotion.delete({ where: { id } }).catch(() => undefined);
}

/**
 * Validate a promo code for a venue — case-insensitive lookup, returns the
 * promotion only if it's currently active (date-window check).
 */
export async function validateCode(
  db: ScopedDb,
  venueId: string,
  code: string,
): Promise<Promotion | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;

  const row = await db.promotion.findUnique({
    where: { venueId_code: { venueId, code: normalized } },
  });
  if (!row) return null;

  const promo = toPromotion(row);
  return promo.status === "active" ? promo : null;
}
