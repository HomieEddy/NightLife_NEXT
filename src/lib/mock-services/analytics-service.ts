/**
 * mockAnalyticsService — future backend boundary for reporting.
 * TODO(backend): replace with SQL aggregations (materialized views) over orders.
 */
import type {
  AnalyticsSummary,
  CategoryDepletionPoint,
  RevenuePoint,
  StaffPerformancePoint,
} from "@/lib/types";
import { mockAnalytics } from "@/lib/mock-data/analytics";
import { clone, delay } from "./delay";

export interface HistoricalAnalytics {
  from: string; // ISO date
  to: string;
  days: number;
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  bestNight: RevenuePoint;
  /** One point per day, oldest first. */
  series: RevenuePoint[];
  revenueByZone: { zoneId: string; zoneName: string; revenue: number }[];
  topItems: { name: string; count: number; revenue: number; categoryId?: string }[];
  staffPerformance: StaffPerformancePoint[];
  categoryDepletion: CategoryDepletionPoint[];
}

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
    const scale = totalRevenue / mockAnalytics.revenueTonight;
    const countScale = totalOrders / mockAnalytics.ordersTonight;

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
        ordersDelivered: Math.max(1, Math.round(s.ordersDelivered * countScale)),
        revenueServed: Math.round(s.revenueServed * scale),
      })),
      categoryDepletion: mockAnalytics.categoryDepletion.map((c) => ({
        ...c,
        unitsSold: Math.max(1, Math.round(c.unitsSold * countScale)),
      })),
    };
  },
};

/** Collapse a daily series into weekly buckets for readable long-range charts. */
export function aggregateWeekly(series: RevenuePoint[]): RevenuePoint[] {
  const buckets: RevenuePoint[] = [];
  for (let i = 0; i < series.length; i += 7) {
    const chunk = series.slice(i, i + 7);
    buckets.push({
      label: chunk[0].label,
      revenue: chunk.reduce((s, p) => s + p.revenue, 0),
      orders: chunk.reduce((s, p) => s + p.orders, 0),
    });
  }
  return buckets;
}
