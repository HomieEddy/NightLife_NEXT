/**
 * mockPromotionsService — future backend boundary for promo codes.
 * The permanent demo counterpart to PostgreSQL-backed promotion validation.
 */
import type { Promotion } from "@/lib/types";
import { mockPromotions } from "@/features/hospitality/promotions-mock-data";
import { mockVenue } from "@/features/venue/mock-data";
import { clone, delay, uid } from "@/features/shared/delay";

let promotions: Promotion[] = clone(mockPromotions);

function sortByDate(list: Promotion[]): Promotion[] {
  return [...list].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export const mockPromotionsService = {
  async listPromotions(): Promise<Promotion[]> {
    await delay();
    return sortByDate(clone(promotions));
  },

  async getPromotion(id: string): Promise<Promotion | null> {
    await delay(200);
    return clone(promotions.find((p) => p.id === id) ?? null);
  },

  async createPromotion(input: Omit<Promotion, "id" | "venueId" | "redemptionCount">): Promise<Promotion> {
    await delay(500);
    const promo: Promotion = {
      id: uid("promo"),
      venueId: mockVenue.id,
      redemptionCount: 0,
      ...input,
    };
    promotions = [promo, ...promotions];
    return clone(promo);
  },

  async updatePromotion(
    id: string,
    patch: Partial<Omit<Promotion, "id" | "venueId" | "redemptionCount">>,
  ): Promise<Promotion | null> {
    await delay(400);
    const promo = promotions.find((p) => p.id === id);
    if (!promo) return null;
    Object.assign(promo, patch);
    return clone(promo);
  },

  async deletePromotion(id: string): Promise<void> {
    await delay(400);
    promotions = promotions.filter((p) => p.id !== id);
  },

  /** Demo lookup — matches active promos by code (case-insensitive). */
  async validateCode(code: string): Promise<Promotion | null> {
    await delay(300);
    const normalized = code.trim().toLowerCase();
    if (!normalized) return null;
    return (
      clone(
        promotions.find(
          (p) => p.code.toLowerCase() === normalized && p.status === "active",
        ),
      ) ?? null
    );
  },
};
