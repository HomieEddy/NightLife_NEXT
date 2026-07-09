import type { Promotion } from "@/lib/types";

const iso = (d: number, h = 0, m = 0) => {
  const dt = new Date();
  dt.setDate(dt.getDate() + d);
  dt.setHours(h, m, 0, 0);
  return dt.toISOString();
};

export const mockPromotions: Promotion[] = [
  {
    id: "promo-1",
    venueId: "venue-1",
    code: "WELCOME10",
    name: "10% off first visit",
    type: "percentage",
    value: 10,
    appliesToCategoryIds: [],
    startsAt: iso(-10),
    endsAt: iso(20),
    status: "active",
    redemptionCount: 34,
  },
  {
    id: "promo-2",
    venueId: "venue-1",
    code: "VIP50",
    name: "50€ off bottles over 500€",
    type: "flat",
    value: 50,
    appliesToCategoryIds: ["cat-champagne", "cat-cognac", "cat-whisky"],
    startsAt: iso(2),
    endsAt: iso(16),
    status: "scheduled",
    redemptionCount: 0,
  },
];
