import type { RevenuePoint } from "@/lib/types";

/** Collapse a daily series into weekly buckets for readable long-range charts. */
export function aggregateWeekly(series: RevenuePoint[]): RevenuePoint[] {
  const buckets: RevenuePoint[] = [];
  for (let i = 0; i < series.length; i += 7) {
    const chunk = series.slice(i, i + 7);
    buckets.push({
      label: chunk[0].label,
      revenue: chunk.reduce((sum, point) => sum + point.revenue, 0),
      orders: chunk.reduce((sum, point) => sum + point.orders, 0),
    });
  }
  return buckets;
}
