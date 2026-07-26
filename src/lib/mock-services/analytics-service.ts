/**
 * mockAnalyticsService — demo-mode analytics with seeded data.
 */
import type {
  AnalyticsSummary,
  RevenuePoint,
  HistoricalAnalytics,
} from "@/lib/types";
import { mockAnalytics } from "@/lib/mock-data/analytics";
import { aggregateWeekly } from "@/lib/analytics";
import { clone, delay } from "./delay";

export { aggregateWeekly };

// Deterministic pseudo-random per date, so ranges are stable across calls.
function seeded(dateKey: string): number {
  let hash = 0;
  for (const char of dateKey) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  hash = (hash * 1103515245 + 12345) >>> 0;
  return (hash % 1000) / 1000; // 0..1
}

/** Nightclub weekly rhythm: dead early week, peaks Friday/Saturday. */
const WEEKDAY_FACTOR = [0.45, 0.12, 0.15, 0.25, 0.75, 1.3, 1.5]; // Sun..Sat

function nightFor(date: Date): RevenuePoint {
  const key = date.toISOString().slice(0, 10);
  const rand = seeded(key);
  const factor = WEEKDAY_FACTOR[date.getDay()];
  const revenue = Math.round(13000 * factor * (0.8 + rand * 0.45));
  const orders = Math.max(1, Math.round(revenue / (105 + rand * 45)));
  const label = `${date.getMonth() + 1}/${date.getDate()}`;
  return { label, revenue, orders };
}

export const mockAnalyticsService = {
  /** Tonight's live snapshot — powers the manager dashboard. */
  async getSummary(): Promise<AnalyticsSummary> {
    await delay(600);
    return clone(mockAnalytics);
  },

  /** Historical aggregates over an inclusive date range. */
  async getHistorical(fromISO: string, toISO: string): Promise<HistoricalAnalytics> {
    await delay(500);
    const from = new Date(`${fromISO}T00:00:00`);
    const to = new Date(`${toISO}T00:00:00`);
    const series: RevenuePoint[] = [];
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      series.push(nightFor(d));
    }
    if (series.length === 0) series.push(nightFor(to));

    const totalRevenue = series.reduce((s, p) => s + p.revenue, 0);
    const totalOrders = series.reduce((s, p) => s + p.orders, 0);
    const bestNight = series.reduce((best, p) => (p.revenue > best.revenue ? p : best), series[0]);

    // Scale tonight's breakdown shapes to the range total — stable, plausible splits.
    // Durations (sold-out minutes) accumulate per night, so they scale by night count.
    const scale = totalRevenue / mockAnalytics.revenueTonight;
    const countScale = totalOrders / mockAnalytics.ordersTonight;
    const nights = series.length;

    return {
      from: fromISO,
      to: toISO,
      days: series.length,
      totalRevenue,
      totalOrders,
      avgOrderValue: Math.round((totalRevenue / totalOrders) * 100) / 100,
      bestNight,
      series,
      revenueByZone: mockAnalytics.revenueByZone.map((z) => ({
        ...z,
        revenue: Math.round(z.revenue * scale),
      })),
      topItems: mockAnalytics.topItems.map((t) => ({
        ...t,
        count: Math.max(1, Math.round(t.count * countScale)),
        revenue: Math.round(t.revenue * scale),
      })),
      staffPerformance: mockAnalytics.staffPerformance.map((s) => ({
        ...s,
        ordersDelivered: s.ordersDelivered > 0 ? Math.max(1, Math.round(s.ordersDelivered * countScale)) : 0,
        revenueServed: Math.round(s.revenueServed * scale),
        helpResolved: s.helpResolved != null ? Math.max(0, Math.round(s.helpResolved * countScale)) : undefined,
      })),
      orderEta: mockAnalytics.orderEta,
      categoryDepletion: mockAnalytics.categoryDepletion.map((c) => ({
        ...c,
        unitsSold: Math.max(1, Math.round(c.unitsSold * countScale)),
        soldOutMinutes: c.soldOutMinutes != null ? Math.round(c.soldOutMinutes * nights) : undefined,
        restockUnits: c.restockUnits != null ? Math.round(c.restockUnits * countScale) : undefined,
      })),
      sessions: mockAnalytics.sessions
        ? {
            ...mockAnalytics.sessions,
            totalSessions: Math.max(1, Math.round(mockAnalytics.sessions.totalSessions * countScale)),
            revenuePerSession: Math.round(mockAnalytics.sessions.revenuePerSession * 100) / 100,
            revenuePerGuest: Math.round(mockAnalytics.sessions.revenuePerGuest * 100) / 100,
          }
        : undefined,
      reservations: mockAnalytics.reservations
        ? {
            ...mockAnalytics.reservations,
            requested: Math.max(1, Math.round(mockAnalytics.reservations.requested * countScale)),
            confirmed: Math.max(1, Math.round(mockAnalytics.reservations.confirmed * countScale)),
            seated: Math.max(1, Math.round(mockAnalytics.reservations.seated * countScale)),
            completed: Math.max(1, Math.round(mockAnalytics.reservations.completed * countScale)),
            cancelled: Math.round(mockAnalytics.reservations.cancelled * countScale),
            totalCovers: Math.round(mockAnalytics.reservations.totalCovers * countScale),
          }
        : undefined,
      happyHours: mockAnalytics.happyHours
        ? {
            ...mockAnalytics.happyHours,
            rules: mockAnalytics.happyHours.rules.map((r) => ({
              ...r,
              orders: Math.max(1, Math.round(r.orders * countScale)),
              revenue: Math.round(r.revenue * scale),
              discountGiven: Math.round(r.discountGiven * scale * 100) / 100,
            })),
            totalHhOrders: Math.round(mockAnalytics.happyHours.totalHhOrders * countScale),
            totalHhRevenue: Math.round(mockAnalytics.happyHours.totalHhRevenue * scale),
            totalDiscountGiven: Math.round(mockAnalytics.happyHours.totalDiscountGiven * scale * 100) / 100,
          }
        : undefined,
      events: mockAnalytics.events
        ? {
            ...mockAnalytics.events,
            events: mockAnalytics.events.events.map((e) => ({
              ...e,
              eventRevenue: Math.round(e.eventRevenue * scale),
              avgWeekdayRevenue: Math.round(e.avgWeekdayRevenue * scale),
            })),
          }
        : undefined,
      promotions: mockAnalytics.promotions
        ? {
            ...mockAnalytics.promotions,
            promotions: mockAnalytics.promotions.promotions.map((p) => ({
              ...p,
              redemptions: Math.max(1, Math.round(p.redemptions * countScale)),
              discountCost: Math.round(p.discountCost * scale * 100) / 100,
              attributedRevenue: Math.round(p.attributedRevenue * scale),
            })),
            totalRedemptions: Math.round(mockAnalytics.promotions.totalRedemptions * countScale),
            totalDiscountCost: Math.round(mockAnalytics.promotions.totalDiscountCost * scale * 100) / 100,
          }
        : undefined,
      orderFunnel: mockAnalytics.orderFunnel
        ? {
            ...mockAnalytics.orderFunnel,
            placed: Math.round(mockAnalytics.orderFunnel.placed * countScale),
            accepted: Math.round(mockAnalytics.orderFunnel.accepted * countScale),
            delivered: Math.round(mockAnalytics.orderFunnel.delivered * countScale),
            cancelled: Math.round(mockAnalytics.orderFunnel.cancelled * countScale),
            serviceFeeRevenue: Math.round(mockAnalytics.orderFunnel.serviceFeeRevenue * scale * 100) / 100,
            giftOrders: Math.round(mockAnalytics.orderFunnel.giftOrders * countScale),
            giftRevenue: Math.round(mockAnalytics.orderFunnel.giftRevenue * scale),
          }
        : undefined,
      inventoryDepth: mockAnalytics.inventoryDepth
        ? {
            ...mockAnalytics.inventoryDepth,
            // Matches the categoryDepletion rows, which also scale by nights.
            totalSoldOutMinutes: Math.round(mockAnalytics.inventoryDepth.totalSoldOutMinutes * nights),
          }
        : undefined,
      promoters: mockAnalytics.promoters
        ? {
            ...mockAnalytics.promoters,
            promoters: mockAnalytics.promoters.promoters.map((p) => ({
              ...p,
              reservationsCreated: Math.max(1, Math.round(p.reservationsCreated * countScale)),
              reservationsConfirmed: Math.max(1, Math.round(p.reservationsConfirmed * countScale)),
              reservationsSeated: Math.max(1, Math.round(p.reservationsSeated * countScale)),
              guestsFunneled: Math.max(1, Math.round(p.guestsFunneled * countScale)),
              attributedRevenue: Math.round(p.attributedRevenue * scale),
              avgSpendPerGuest: Math.round(p.avgSpendPerGuest * 100) / 100,
              avgSpendPerParty: Math.round(p.avgSpendPerParty * 100) / 100,
              topTable: p.topTable ? { ...p.topTable, revenue: Math.round(p.topTable.revenue * scale) } : undefined,
            })),
            totalGuestsFunneled: Math.max(1, Math.round(mockAnalytics.promoters.totalGuestsFunneled * countScale)),
            totalAttributedRevenue: Math.round(mockAnalytics.promoters.totalAttributedRevenue * scale),
          }
        : undefined,
    };
  },
};

