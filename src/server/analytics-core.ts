/**
 * Analytics core: tonight SQL queries, nightly rollup computation,
 * and historical range reads from rollup rows.
 */
import type { PrismaClient } from "@prisma/client";
import type { getDb } from "./db";
import { getRawPrisma } from "./db";
import { fromCents } from "./money";
import { nightContaining, nightForDate, type NightBoundary, type NightConfig } from "./night";
import type {
  AnalyticsSummary,
  CategoryDepletionPoint,
  RevenuePoint,
  StaffPerformancePoint,
} from "@/lib/types";
import type { HistoricalAnalytics } from "@/lib/types";

type ScopedDb = ReturnType<typeof getDb>;

// ── Tonight summary (live SQL) ──────────────────────────────────────

export async function getSummaryForVenue(
  db: ScopedDb,
  venueId: string,
  nightConfig: NightConfig,
): Promise<AnalyticsSummary> {
  const now = new Date();
  const tonight = nightContaining(now, nightConfig);
  const lastNight = nightForDate(previousDate(tonight.label), nightConfig);

  const [tonightStats, lastNightStats, activeTables, totalTables] =
    await Promise.all([
      queryNightStats(db, tonight),
      queryNightStats(db, lastNight),
      db.venueTable.count({ where: { status: "occupied" } }),
      db.venueTable.count(),
    ]);

  const delta = (current: number, previous: number) =>
    previous === 0 ? 0 : Math.round(((current - previous) / previous) * 100);

  return {
    revenueTonight: fromCents(tonightStats.revenueCents),
    revenueDeltaPct: delta(tonightStats.revenueCents, lastNightStats.revenueCents),
    ordersTonight: tonightStats.orderCount,
    ordersDeltaPct: delta(tonightStats.orderCount, lastNightStats.orderCount),
    avgOrderValue: tonightStats.orderCount > 0
      ? fromCents(Math.round(tonightStats.revenueCents / tonightStats.orderCount))
      : 0,
    avgOrderDeltaPct: delta(
      tonightStats.orderCount > 0 ? tonightStats.revenueCents / tonightStats.orderCount : 0,
      lastNightStats.orderCount > 0 ? lastNightStats.revenueCents / lastNightStats.orderCount : 0,
    ),
    activeTables,
    totalTables,
    avgFulfillmentMinutes: tonightStats.avgFulfillmentMinutes,
    topItems: tonightStats.topItems,
    revenueByHour: tonightStats.revenueByHour,
    revenueByDay: [],
    revenueByZone: tonightStats.revenueByZone,
    staffPerformance: tonightStats.staffPerformance,
    categoryDepletion: tonightStats.categoryDepletion,
  };
}

interface NightStats {
  revenueCents: number;
  orderCount: number;
  avgFulfillmentMinutes: number;
  topItems: { name: string; count: number; revenue: number; categoryId?: string }[];
  revenueByHour: RevenuePoint[];
  revenueByZone: { zoneId: string; zoneName: string; revenue: number }[];
  staffPerformance: StaffPerformancePoint[];
  categoryDepletion: CategoryDepletionPoint[];
}

async function queryNightStats(db: ScopedDb, night: NightBoundary): Promise<NightStats> {
  const orders = await db.order.findMany({
    where: {
      placedAt: { gte: night.start, lt: night.end },
      status: { not: "cancelled" },
    },
    include: { items: true },
  });

  const revenueCents = orders.reduce((s, o) => s + o.totalCents, 0);
  const orderCount = orders.length;

  // Avg fulfillment: time from placedAt to updatedAt for delivered orders
  const delivered = orders.filter((o) => o.status === "delivered");
  const avgFulfillmentMinutes = delivered.length > 0
    ? Math.round(
        delivered.reduce(
          (s, o) => s + (o.updatedAt.getTime() - o.placedAt.getTime()) / 60_000,
          0,
        ) / delivered.length,
      )
    : 0;

  // Top items by quantity
  const itemMap = new Map<string, { name: string; count: number; revenueCents: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      const existing = itemMap.get(item.name) ?? { name: item.name, count: 0, revenueCents: 0 };
      existing.count += item.quantity;
      existing.revenueCents += item.unitCents * item.quantity;
      itemMap.set(item.name, existing);
    }
  }
  const topItems = [...itemMap.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((i) => ({ name: i.name, count: i.count, revenue: fromCents(i.revenueCents) }));

  // Revenue by hour
  const hourBuckets = new Map<number, { revenue: number; orders: number }>();
  for (const order of orders) {
    const h = order.placedAt.getUTCHours();
    const bucket = hourBuckets.get(h) ?? { revenue: 0, orders: 0 };
    bucket.revenue += fromCents(order.totalCents);
    bucket.orders += 1;
    hourBuckets.set(h, bucket);
  }
  const revenueByHour: RevenuePoint[] = [...hourBuckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([h, v]) => ({ label: `${h}:00`, revenue: v.revenue, orders: v.orders }));

  // Revenue by zone
  const zoneMap = new Map<string, { zoneName: string; revenueCents: number }>();
  for (const order of orders) {
    const z = zoneMap.get(order.zoneId) ?? { zoneName: order.zoneName, revenueCents: 0 };
    z.revenueCents += order.totalCents;
    zoneMap.set(order.zoneId, z);
  }
  const revenueByZone = [...zoneMap.entries()].map(([zoneId, z]) => ({
    zoneId,
    zoneName: z.zoneName,
    revenue: fromCents(z.revenueCents),
  }));

  // Staff performance
  const staffMap = new Map<string, { name: string; ordersDelivered: number; totalMinutes: number; revenueServedCents: number }>();
  for (const order of delivered) {
    if (!order.claimedByStaffId) continue;
    const s = staffMap.get(order.claimedByStaffId) ?? {
      name: order.claimedByStaffName ?? "Unknown",
      ordersDelivered: 0,
      totalMinutes: 0,
      revenueServedCents: 0,
    };
    s.ordersDelivered += 1;
    s.totalMinutes += (order.updatedAt.getTime() - order.placedAt.getTime()) / 60_000;
    s.revenueServedCents += order.totalCents;
    staffMap.set(order.claimedByStaffId, s);
  }
  const staffPerformance: StaffPerformancePoint[] = [...staffMap.entries()].map(
    ([staffId, s]) => ({
      staffId,
      name: s.name,
      role: "runner" as const,
      ordersDelivered: s.ordersDelivered,
      avgDeliveryMinutes: Math.round(s.totalMinutes / s.ordersDelivered),
      revenueServed: fromCents(s.revenueServedCents),
    }),
  );

  // Category depletion from stock movements in this night window
  const movements = await db.stockMovement.findMany({
    where: {
      createdAt: { gte: night.start, lt: night.end },
      type: "sale",
    },
    include: { menuItem: { select: { id: true, inventory: true, category: { select: { id: true, name: true } } } } },
  });

  const catMap = new Map<string, { categoryName: string; unitsSold: number; unitsInStock: number }>();
  for (const m of movements) {
    const cat = m.menuItem.category;
    const c = catMap.get(cat.id) ?? { categoryName: cat.name, unitsSold: 0, unitsInStock: 0 };
    c.unitsSold += Math.abs(m.delta);
    c.unitsInStock = Math.max(c.unitsInStock, m.menuItem.inventory);
    catMap.set(cat.id, c);
  }
  const categoryDepletion: CategoryDepletionPoint[] = [...catMap.entries()].map(
    ([categoryId, c]) => ({ categoryId, categoryName: c.categoryName, unitsSold: c.unitsSold, unitsInStock: c.unitsInStock }),
  );

  return {
    revenueCents,
    orderCount,
    avgFulfillmentMinutes,
    topItems,
    revenueByHour,
    revenueByZone,
    staffPerformance,
    categoryDepletion,
  };
}

// ── Nightly rollup ──────────────────────────────────────────────────

export interface RollupData {
  revenueCents: number;
  orderCount: number;
  avgOrderCents: number;
  byZone: { v: number; zones: { zoneId: string; zoneName: string; revenueCents: number; orderCount: number }[] };
  topItems: { v: number; items: { name: string; count: number; revenueCents: number; categoryId?: string }[] };
  staffPerformance: { v: number; staff: { staffId: string; name: string; role: string; ordersDelivered: number; avgDeliveryMinutes: number; revenueServedCents: number }[] };
  categoryDepletion: { v: number; categories: { categoryId: string; categoryName: string; unitsSold: number }[] };
}

/**
 * Compute rollup data for a single night from live order data.
 * Pure aggregation — does not write to DB.
 */
export async function computeRollup(
  db: ScopedDb,
  night: NightBoundary,
): Promise<RollupData> {
  const stats = await queryNightStats(db, night);

  const zoneOrders = new Map<string, number>();
  const orders = await db.order.findMany({
    where: {
      placedAt: { gte: night.start, lt: night.end },
      status: { not: "cancelled" },
    },
    select: { zoneId: true },
  });
  for (const o of orders) {
    zoneOrders.set(o.zoneId, (zoneOrders.get(o.zoneId) ?? 0) + 1);
  }

  return {
    revenueCents: stats.revenueCents,
    orderCount: stats.orderCount,
    avgOrderCents: stats.orderCount > 0
      ? Math.round(stats.revenueCents / stats.orderCount)
      : 0,
    byZone: {
      v: 1,
      zones: stats.revenueByZone.map((z) => ({
        zoneId: z.zoneId,
        zoneName: z.zoneName,
        revenueCents: Math.round(z.revenue * 100),
        orderCount: zoneOrders.get(z.zoneId) ?? 0,
      })),
    },
    topItems: {
      v: 1,
      items: stats.topItems.map((i) => ({
        name: i.name,
        count: i.count,
        revenueCents: Math.round(i.revenue * 100),
        categoryId: i.categoryId,
      })),
    },
    staffPerformance: {
      v: 1,
      staff: stats.staffPerformance.map((s) => ({
        staffId: s.staffId,
        name: s.name,
        role: s.role,
        ordersDelivered: s.ordersDelivered,
        avgDeliveryMinutes: s.avgDeliveryMinutes,
        revenueServedCents: Math.round(s.revenueServed * 100),
      })),
    },
    categoryDepletion: {
      v: 1,
      categories: stats.categoryDepletion.map((c) => ({
        categoryId: c.categoryId,
        categoryName: c.categoryName,
        unitsSold: c.unitsSold,
      })),
    },
  };
}

/**
 * Idempotent upsert: write (or overwrite) a rollup row for a single night.
 */
export async function upsertRollup(
  raw: PrismaClient,
  venueId: string,
  nightDate: string,
  data: RollupData,
): Promise<void> {
  await raw.nightlyRollup.upsert({
    where: { venueId_nightDate: { venueId, nightDate } },
    create: {
      venueId,
      nightDate,
      revenueCents: data.revenueCents,
      orderCount: data.orderCount,
      avgOrderCents: data.avgOrderCents,
      byZone: data.byZone as object,
      topItems: data.topItems as object,
      staffPerformance: data.staffPerformance as object,
      categoryDepletion: data.categoryDepletion as object,
    },
    update: {
      revenueCents: data.revenueCents,
      orderCount: data.orderCount,
      avgOrderCents: data.avgOrderCents,
      byZone: data.byZone as object,
      topItems: data.topItems as object,
      staffPerformance: data.staffPerformance as object,
      categoryDepletion: data.categoryDepletion as object,
      computedAt: new Date(),
    },
  });
}

// ── Historical reads (from rollup rows) ─────────────────────────────

export async function getHistoricalForVenue(
  db: ScopedDb,
  fromISO: string,
  toISO: string,
): Promise<HistoricalAnalytics> {
  const rollups = await db.nightlyRollup.findMany({
    where: { nightDate: { gte: fromISO, lte: toISO } },
    orderBy: { nightDate: "asc" },
  });

  const series: RevenuePoint[] = rollups.map((r) => ({
    label: formatLabel(r.nightDate),
    revenue: fromCents(r.revenueCents),
    orders: r.orderCount,
  }));

  const totalRevenue = rollups.reduce((s, r) => s + fromCents(r.revenueCents), 0);
  const totalOrders = rollups.reduce((s, r) => s + r.orderCount, 0);
  const bestNight = series.length > 0
    ? series.reduce((best, p) => (p.revenue > best.revenue ? p : best), series[0])
    : { label: "", revenue: 0, orders: 0 };

  // Merge JSONB aggregates across rollup rows
  const zoneMap = new Map<string, { zoneName: string; revenue: number }>();
  const itemMap = new Map<string, { count: number; revenue: number; categoryId?: string }>();
  const staffMap = new Map<string, { name: string; role: string; ordersDelivered: number; totalMinutes: number; revenueServed: number }>();
  const catMap = new Map<string, { categoryName: string; unitsSold: number }>();

  for (const r of rollups) {
    const byZone = r.byZone as { zones?: { zoneId: string; zoneName: string; revenueCents: number }[] };
    for (const z of byZone.zones ?? []) {
      const existing = zoneMap.get(z.zoneId) ?? { zoneName: z.zoneName, revenue: 0 };
      existing.revenue += fromCents(z.revenueCents);
      zoneMap.set(z.zoneId, existing);
    }

    const topItems = r.topItems as { items?: { name: string; count: number; revenueCents: number; categoryId?: string }[] };
    for (const i of topItems.items ?? []) {
      const existing = itemMap.get(i.name) ?? { count: 0, revenue: 0, categoryId: i.categoryId };
      existing.count += i.count;
      existing.revenue += fromCents(i.revenueCents);
      itemMap.set(i.name, existing);
    }

    const perf = r.staffPerformance as { staff?: { staffId: string; name: string; role: string; ordersDelivered: number; avgDeliveryMinutes: number; revenueServedCents: number }[] };
    for (const s of perf.staff ?? []) {
      const existing = staffMap.get(s.staffId) ?? { name: s.name, role: s.role, ordersDelivered: 0, totalMinutes: 0, revenueServed: 0 };
      existing.ordersDelivered += s.ordersDelivered;
      existing.totalMinutes += s.avgDeliveryMinutes * s.ordersDelivered;
      existing.revenueServed += fromCents(s.revenueServedCents);
      staffMap.set(s.staffId, existing);
    }

    const depletion = r.categoryDepletion as { categories?: { categoryId: string; categoryName: string; unitsSold: number }[] };
    for (const c of depletion.categories ?? []) {
      const existing = catMap.get(c.categoryId) ?? { categoryName: c.categoryName, unitsSold: 0 };
      existing.unitsSold += c.unitsSold;
      catMap.set(c.categoryId, existing);
    }
  }

  return {
    from: fromISO,
    to: toISO,
    days: rollups.length,
    totalRevenue,
    totalOrders,
    avgOrderValue: totalOrders > 0 ? Math.round((totalRevenue / totalOrders) * 100) / 100 : 0,
    bestNight,
    series,
    revenueByZone: [...zoneMap.entries()].map(([zoneId, z]) => ({
      zoneId,
      zoneName: z.zoneName,
      revenue: z.revenue,
    })),
    topItems: [...itemMap.entries()]
      .map(([name, i]) => ({ name, count: i.count, revenue: i.revenue, categoryId: i.categoryId }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    staffPerformance: [...staffMap.entries()].map(([staffId, s]) => ({
      staffId,
      name: s.name,
      role: s.role as StaffPerformancePoint["role"],
      ordersDelivered: s.ordersDelivered,
      avgDeliveryMinutes: s.ordersDelivered > 0 ? Math.round(s.totalMinutes / s.ordersDelivered) : 0,
      revenueServed: s.revenueServed,
    })),
    categoryDepletion: [...catMap.entries()].map(([categoryId, c]) => ({
      categoryId,
      categoryName: c.categoryName,
      unitsSold: c.unitsSold,
      unitsInStock: 0,
    })),
  };
}

// ── Helpers ─────────────────────────────────────────────────────────

function previousDate(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return formatIsoDate(d);
}

function formatIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatLabel(nightDate: string): string {
  const [, m, d] = nightDate.split("-");
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}
