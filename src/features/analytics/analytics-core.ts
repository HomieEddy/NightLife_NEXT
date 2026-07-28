/**
 * Analytics core: tonight SQL queries, nightly rollup computation,
 * and historical range reads from rollup rows.
 */
import type { PrismaClient } from "@prisma/client";
import type { getDb } from "@/features/shared/db";
import { getRawPrisma } from "@/features/shared/db";
import { fromCents } from "@/features/shared/money";
import { nightContaining, nightForDate, type NightBoundary, type NightConfig } from "@/features/shared/night";
import type {
  AnalyticsSummary,
  CategoryDepletionPoint,
  EventAnalytics,
  HappyHourAnalytics,
  OrderEtaMetrics,
  PromotionAnalytics,
  RevenuePoint,
  SessionAnalytics,
  ReservationAnalytics,
  OrderFunnelAnalytics,
  StaffPerformancePoint,
} from "@/lib/types";
import type { HistoricalAnalytics, SettlementMethod } from "@/lib/types";

const ORDER_ROLES = new Set(["bartender", "host"]);
const HELP_ROLES = new Set(["runner"]);

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
      queryNightStats(db, venueId, tonight),
      queryNightStats(db, venueId, lastNight),
      db.venueTable.count({ where: { status: "occupied" } }),
      db.venueTable.count(),
    ]);

  const delta = (current: number, previous: number) =>
    previous === 0 ? 0 : Math.round(((current - previous) / previous) * 100);

  // Snapshot: sessions, reservations, order funnel for tonight's window
  const [sessions, reservations, allOrders] = await Promise.all([
    db.guestSession.findMany({ where: { createdAt: { gte: tonight.start, lt: tonight.end } } }),
    db.reservation.findMany({ where: { createdAt: { gte: tonight.start, lt: tonight.end } } }),
    db.order.findMany({
      where: { placedAt: { gte: tonight.start, lt: tonight.end } },
      include: { items: true, feeLines: true },
    }),
  ]);

  let sessionAnalytics: SessionAnalytics | undefined;
  if (sessions.length > 0) {
    const approved = sessions.filter((s) => s.status !== "denied" && s.status !== "pending");
    const denied = sessions.filter((s) => s.status === "denied");
    const closed = sessions.filter((s) => s.status === "closed");
    const totalPartySize = sessions.reduce((sum, s) => sum + s.partySize, 0);
    const revenueTonight = fromCents(tonightStats.revenueCents);

    const settlementCounts: Record<string, number> = {};
    for (const s of closed) {
      const method = s.settlementMethod ?? "cash";
      settlementCounts[method] = (settlementCounts[method] ?? 0) + 1;
    }
    const settlementMix = Object.entries(settlementCounts)
      .map(([method, count]) => ({
        method: method as SettlementMethod,
        count,
        pct: closed.length > 0 ? count / closed.length : 0,
      }))
      .sort((a, b) => b.count - a.count);

    sessionAnalytics = {
      totalSessions: sessions.length,
      approvalRate: approved.length / sessions.length,
      denialRate: denied.length / sessions.length,
      avgApprovalMinutes: 2,
      avgDurationMinutes: closed.length > 0
        ? Math.round(closed.reduce((sum, s) => {
            const end = s.settledExternallyAt ?? s.updatedAt;
            return sum + (end.getTime() - s.createdAt.getTime()) / 60_000;
          }, 0) / closed.length)
        : 0,
      avgPartySize: Math.round(totalPartySize / sessions.length),
      revenuePerSession: Math.round((revenueTonight / sessions.length) * 100) / 100,
      revenuePerGuest: totalPartySize > 0 ? Math.round((revenueTonight / totalPartySize) * 100) / 100 : 0,
      settlementMix,
      avgClosureMinutes: 5,
    };
  }

  let reservationAnalytics: ReservationAnalytics | undefined;
  if (reservations.length > 0) {
    const confirmed = reservations.filter((r) => r.status === "confirmed" || r.status === "seated" || r.status === "completed");
    const seated = reservations.filter((r) => r.status === "seated" || r.status === "completed");
    const cancelled = reservations.filter((r) => r.status === "cancelled");
    const totalCovers = reservations.reduce((sum, r) => sum + r.partySize, 0);

    reservationAnalytics = {
      requested: reservations.length,
      confirmed: confirmed.length,
      seated: seated.length,
      completed: reservations.filter((r) => r.status === "completed").length,
      cancelled: cancelled.length,
      confirmRate: confirmed.length / reservations.length,
      seatedRate: confirmed.length > 0 ? seated.length / confirmed.length : 0,
      cancellationRate: cancelled.length / reservations.length,
      noShowRate: confirmed.length > 0 ? Math.max(0, (confirmed.length - seated.length)) / confirmed.length : 0,
      avgLeadDays: 3,
      totalCovers,
      sourceSplit: [],
      channelSplit: [],
      partySizeDistribution: [],
    };
  }

  let orderFunnel: OrderFunnelAnalytics | undefined;
  if (allOrders.length > 0) {
    const delivered = allOrders.filter((o) => o.status === "delivered");
    const cancelled = allOrders.filter((o) => o.status === "cancelled");
    const tipped = allOrders.filter((o) => o.tipCents > 0);
    const totalFeeRevenue = allOrders.reduce((s, o) => s + o.totalFeeCents, 0);
    const totalTips = tipped.reduce((s, o) => s + o.tipCents, 0);

    orderFunnel = {
      placed: allOrders.length,
      accepted: allOrders.length - cancelled.length,
      preparing: 0,
      delivered: delivered.length,
      cancelled: cancelled.length,
      cancellationRate: cancelled.length / allOrders.length,
      tipRate: tipped.length / allOrders.length,
      avgTip: tipped.length > 0 ? fromCents(Math.round(totalTips / tipped.length)) : 0,
      serviceFeeRevenue: fromCents(totalFeeRevenue),
      giftOrders: 0,
      giftRevenue: 0,
      modifierAttachRate: 0,
    };
  }

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
    orderEta: tonightStats.orderEta,
    topItems: tonightStats.topItems,
    revenueByHour: tonightStats.revenueByHour,
    revenueByDay: [],
    revenueByZone: tonightStats.revenueByZone,
    staffPerformance: tonightStats.staffPerformance,
    categoryDepletion: tonightStats.categoryDepletion,
    sessions: sessionAnalytics,
    reservations: reservationAnalytics,
    orderFunnel,
  };
}

/** shiftHours is rollup-internal — raw hours scheduled that night, needed to
 *  re-derive ordersPerShiftHour (a rate) when merging across many rollups. */
type StaffPerfInternal = StaffPerformancePoint & { shiftHours: number };

interface NightStats {
  revenueCents: number;
  orderCount: number;
  avgFulfillmentMinutes: number;
  orderEta: OrderEtaMetrics;
  orderEtaRaw: { acceptCount: number; acceptTotal: number; prepCount: number; prepTotal: number; totalCount: number; totalTotal: number };
  topItems: { name: string; count: number; revenue: number; categoryId?: string }[];
  revenueByHour: RevenuePoint[];
  revenueByZone: { zoneId: string; zoneName: string; revenue: number }[];
  staffPerformance: StaffPerfInternal[];
  categoryDepletion: CategoryDepletionPoint[];
}

async function queryNightStats(db: ScopedDb, venueId: string, night: NightBoundary): Promise<NightStats> {
  // The night's label is already the venue-local calendar date (see night.ts) —
  // noon avoids any UTC-parsing day-boundary edge case when reading its weekday.
  const nightDayOfWeek = new Date(`${night.label}T12:00:00`).getDay();

  const [orders, memberRows, helpRows, shiftRows] = await Promise.all([
    db.order.findMany({
      where: {
        placedAt: { gte: night.start, lt: night.end },
        status: { not: "cancelled" },
      },
      include: { items: true },
    }),
    // Member/StaffProfile aren't venue-scoped by the getDb extension — filter explicitly.
    db.member.findMany({
      where: { organizationId: venueId },
      include: { user: { include: { staffProfile: true } } },
    }),
    db.helpRequest.findMany({
      where: {
        createdAt: { gte: night.start, lt: night.end },
        status: "resolved",
        resolvedByStaffId: { not: null },
      },
    }),
    db.staffShift.findMany({ where: { dayOfWeek: nightDayOfWeek } }),
  ]);
  const staffRoleById = new Map<string, string>();
  for (const m of memberRows) {
    if (m.user.staffProfile) staffRoleById.set(m.userId, m.user.staffProfile.role);
  }

  // Scheduled hours per staff on this specific night — for orders/shift-hour.
  const shiftHoursByStaff = new Map<string, number>();
  for (const shift of shiftRows) {
    const [startH, startM] = shift.startTime.split(":").map(Number);
    const [endH, endM] = shift.endTime.split(":").map(Number);
    const startMin = startH * 60 + startM;
    let endMin = endH * 60 + endM;
    if (endMin <= startMin) endMin += 24 * 60; // overnight shift
    const hours = (endMin - startMin) / 60;
    shiftHoursByStaff.set(shift.staffId, (shiftHoursByStaff.get(shift.staffId) ?? 0) + hours);
  }

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

  // Staff performance — role-calibrated: order metrics for bartender/host only,
  // help metrics for runner only.
  interface StaffAgg {
    name: string; ordersDelivered: number; totalMinutes: number; revenueServedCents: number;
    helpResolved: number; totalHelpMinutes: number; acceptedCount: number; totalAcceptMinutes: number;
  }
  const staffMap = new Map<string, StaffAgg>();
  const getStaffAgg = (staffId: string, name: string): StaffAgg => {
    const existing = staffMap.get(staffId);
    if (existing) return existing;
    const created: StaffAgg = {
      name, ordersDelivered: 0, totalMinutes: 0, revenueServedCents: 0,
      helpResolved: 0, totalHelpMinutes: 0, acceptedCount: 0, totalAcceptMinutes: 0,
    };
    staffMap.set(staffId, created);
    return created;
  };

  // Order ETA accumulators (across all eligible delivered orders)
  let etaAcceptCount = 0;
  let etaAcceptTotal = 0;
  let etaPrepCount = 0;
  let etaPrepTotal = 0;
  let etaTotalCount = 0;
  let etaTotalTotal = 0;

  for (const order of delivered) {
    if (!order.claimedByStaffId) continue;
    const role = staffRoleById.get(order.claimedByStaffId);
    if (!role || !ORDER_ROLES.has(role)) continue;
    const s = getStaffAgg(order.claimedByStaffId, order.claimedByStaffName ?? "Unknown");
    s.ordersDelivered += 1;
    const totalMin = (order.updatedAt.getTime() - order.placedAt.getTime()) / 60_000;
    s.totalMinutes += totalMin;
    s.revenueServedCents += order.totalCents;
    etaTotalCount += 1;
    etaTotalTotal += totalMin;
    if (order.acceptedAt) {
      const acceptMin = (order.acceptedAt.getTime() - order.placedAt.getTime()) / 60_000;
      const prepMin = (order.updatedAt.getTime() - order.acceptedAt.getTime()) / 60_000;
      s.acceptedCount += 1;
      s.totalAcceptMinutes += acceptMin;
      etaAcceptCount += 1;
      etaAcceptTotal += acceptMin;
      etaPrepCount += 1;
      etaPrepTotal += prepMin;
    }
  }
  for (const help of helpRows) {
    if (!help.resolvedByStaffId) continue;
    const role = staffRoleById.get(help.resolvedByStaffId);
    if (!role || !HELP_ROLES.has(role)) continue;
    const s = getStaffAgg(help.resolvedByStaffId, help.resolvedByStaffName ?? "Unknown");
    s.helpResolved += 1;
    s.totalHelpMinutes += (help.updatedAt.getTime() - help.createdAt.getTime()) / 60_000;
  }
  const staffPerformance: StaffPerfInternal[] = [...staffMap.entries()].map(
    ([staffId, s]) => {
      const shiftHours = shiftHoursByStaff.get(staffId) ?? 0;
      return {
        staffId,
        name: s.name,
        role: (staffRoleById.get(staffId) as StaffPerformancePoint["role"]) ?? "runner",
        ordersDelivered: s.ordersDelivered,
        avgDeliveryMinutes: s.ordersDelivered > 0 ? Math.round(s.totalMinutes / s.ordersDelivered) : 0,
        revenueServed: fromCents(s.revenueServedCents),
        helpResolved: s.helpResolved,
        avgHelpMinutes: s.helpResolved > 0 ? Math.round((s.totalHelpMinutes / s.helpResolved) * 10) / 10 : undefined,
        avgAcceptMinutes: s.acceptedCount > 0 ? Math.round((s.totalAcceptMinutes / s.acceptedCount) * 10) / 10 : undefined,
        ordersPerShiftHour: shiftHours > 0 ? Math.round((s.ordersDelivered / shiftHours) * 10) / 10 : undefined,
        shiftHours,
      };
    },
  );

  const orderEta: OrderEtaMetrics = {
    avgAcceptMinutes: etaAcceptCount > 0 ? Math.round((etaAcceptTotal / etaAcceptCount) * 10) / 10 : 0,
    avgPrepMinutes: etaPrepCount > 0 ? Math.round((etaPrepTotal / etaPrepCount) * 10) / 10 : 0,
    avgTotalMinutes: etaTotalCount > 0 ? Math.round((etaTotalTotal / etaTotalCount) * 10) / 10 : 0,
  };

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
    orderEta,
    orderEtaRaw: { acceptCount: etaAcceptCount, acceptTotal: etaAcceptTotal, prepCount: etaPrepCount, prepTotal: etaPrepTotal, totalCount: etaTotalCount, totalTotal: etaTotalTotal },
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
  staffPerformance: { v: number; staff: { staffId: string; name: string; role: string; ordersDelivered: number; avgDeliveryMinutes: number; revenueServedCents: number; helpResolved: number; avgHelpMinutes?: number; avgAcceptMinutes?: number; shiftHours: number }[]; eta?: { acceptCount: number; acceptTotal: number; prepCount: number; prepTotal: number; totalCount: number; totalTotal: number } };
  categoryDepletion: { v: number; categories: { categoryId: string; categoryName: string; unitsSold: number }[] };
}

/**
 * Compute rollup data for a single night from live order data.
 * Pure aggregation — does not write to DB.
 */
export async function computeRollup(
  db: ScopedDb,
  venueId: string,
  night: NightBoundary,
): Promise<RollupData> {
  const stats = await queryNightStats(db, venueId, night);

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
        helpResolved: s.helpResolved ?? 0,
        avgHelpMinutes: s.avgHelpMinutes,
        avgAcceptMinutes: s.avgAcceptMinutes,
        shiftHours: s.shiftHours,
      })),
      eta: stats.orderEtaRaw,
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
  const staffMap = new Map<string, { name: string; role: string; ordersDelivered: number; totalMinutes: number; revenueServed: number; helpResolved: number; totalHelpMinutes: number; totalAcceptMinutes: number; shiftHours: number }>();
  const catMap = new Map<string, { categoryName: string; unitsSold: number }>();
  const etaAcc = { acceptCount: 0, acceptTotal: 0, prepCount: 0, prepTotal: 0, totalCount: 0, totalTotal: 0 };

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

    const perf = r.staffPerformance as { staff?: { staffId: string; name: string; role: string; ordersDelivered: number; avgDeliveryMinutes: number; revenueServedCents: number; helpResolved?: number; avgHelpMinutes?: number; avgAcceptMinutes?: number; shiftHours?: number }[]; eta?: { acceptCount: number; acceptTotal: number; prepCount: number; prepTotal: number; totalCount: number; totalTotal: number } };
    for (const s of perf.staff ?? []) {
      const existing = staffMap.get(s.staffId) ?? { name: s.name, role: s.role, ordersDelivered: 0, totalMinutes: 0, revenueServed: 0, helpResolved: 0, totalHelpMinutes: 0, totalAcceptMinutes: 0, shiftHours: 0 };
      existing.ordersDelivered += s.ordersDelivered;
      existing.totalMinutes += s.avgDeliveryMinutes * s.ordersDelivered;
      existing.revenueServed += fromCents(s.revenueServedCents);
      existing.helpResolved += s.helpResolved ?? 0;
      existing.totalHelpMinutes += (s.avgHelpMinutes ?? 0) * (s.helpResolved ?? 0);
      existing.totalAcceptMinutes += (s.avgAcceptMinutes ?? 0) * s.ordersDelivered;
      existing.shiftHours += s.shiftHours ?? 0;
      staffMap.set(s.staffId, existing);
    }
    if (perf.eta) {
      etaAcc.acceptCount += perf.eta.acceptCount;
      etaAcc.acceptTotal += perf.eta.acceptTotal;
      etaAcc.prepCount += perf.eta.prepCount;
      etaAcc.prepTotal += perf.eta.prepTotal;
      etaAcc.totalCount += perf.eta.totalCount;
      etaAcc.totalTotal += perf.eta.totalTotal;
    }

    const depletion = r.categoryDepletion as { categories?: { categoryId: string; categoryName: string; unitsSold: number }[] };
    for (const c of depletion.categories ?? []) {
      const existing = catMap.get(c.categoryId) ?? { categoryName: c.categoryName, unitsSold: 0 };
      existing.unitsSold += c.unitsSold;
      catMap.set(c.categoryId, existing);
    }
  }

  // ── Compute sessions analytics from live data ──────────────────
  const fromDate = new Date(`${fromISO}T00:00:00Z`);
  const toDate = new Date(`${toISO}T23:59:59Z`);

  const sessions = await db.guestSession.findMany({
    where: { createdAt: { gte: fromDate, lte: toDate } },
  });

  let sessionAnalytics: SessionAnalytics | undefined;
  if (sessions.length > 0) {
    const approved = sessions.filter((s) => s.status !== "denied" && s.status !== "pending");
    const denied = sessions.filter((s) => s.status === "denied");
    const closed = sessions.filter((s) => s.status === "closed");
    const totalPartySize = sessions.reduce((sum, s) => sum + s.partySize, 0);
    const totalSessionRevenue = totalRevenue;
    const totalGuests = totalPartySize;

    const settlementCounts: Record<string, number> = {};
    for (const s of closed) {
      const method = s.settlementMethod ?? "cash";
      settlementCounts[method] = (settlementCounts[method] ?? 0) + 1;
    }
    const settlementMix = Object.entries(settlementCounts)
      .map(([method, count]) => ({
        method: method as SettlementMethod,
        count,
        pct: closed.length > 0 ? count / closed.length : 0,
      }))
      .sort((a, b) => b.count - a.count);

    sessionAnalytics = {
      totalSessions: sessions.length,
      approvalRate: sessions.length > 0 ? approved.length / sessions.length : 0,
      denialRate: sessions.length > 0 ? denied.length / sessions.length : 0,
      avgApprovalMinutes: 2,
      avgDurationMinutes: closed.length > 0
        ? Math.round(closed.reduce((sum, s) => {
            const end = s.settledExternallyAt ?? s.updatedAt;
            return sum + (end.getTime() - s.createdAt.getTime()) / 60_000;
          }, 0) / closed.length)
        : 0,
      avgPartySize: sessions.length > 0 ? Math.round(totalPartySize / sessions.length) : 0,
      revenuePerSession: sessions.length > 0 ? Math.round((totalSessionRevenue / sessions.length) * 100) / 100 : 0,
      revenuePerGuest: totalGuests > 0 ? Math.round((totalSessionRevenue / totalGuests) * 100) / 100 : 0,
      settlementMix,
      avgClosureMinutes: 5,
    };
  }

  // ── Compute reservation analytics from live data ──────────────
  const reservations = await db.reservation.findMany({
    where: { createdAt: { gte: fromDate, lte: toDate } },
  });

  let reservationAnalytics: ReservationAnalytics | undefined;
  if (reservations.length > 0) {
    const confirmed = reservations.filter((r) => r.status === "confirmed" || r.status === "seated" || r.status === "completed");
    const seated = reservations.filter((r) => r.status === "seated" || r.status === "completed");
    const completed = reservations.filter((r) => r.status === "completed");
    const cancelled = reservations.filter((r) => r.status === "cancelled");
    const totalCovers = reservations.reduce((sum, r) => sum + r.partySize, 0);

    const sourceCounts: Record<string, number> = {};
    for (const r of reservations) {
      const src = r.source ?? "manager";
      sourceCounts[src] = (sourceCounts[src] ?? 0) + 1;
    }
    const sourceSplit = Object.entries(sourceCounts)
      .map(([source, count]) => ({
        source: source as "manager" | "public",
        count,
        pct: reservations.length > 0 ? count / reservations.length : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const channelCounts: Record<string, number> = {};
    for (const r of reservations) {
      const ch = r.source === "manager" ? "manager" : (r.channel ?? "direct");
      channelCounts[ch] = (channelCounts[ch] ?? 0) + 1;
    }
    const channelSplit = Object.entries(channelCounts)
      .map(([channel, count]) => ({
        channel: channel as "manager" | "embed" | "direct" | "walk-in",
        count,
        pct: reservations.length > 0 ? count / reservations.length : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const sizeMap: Record<number, number> = {};
    for (const r of reservations) {
      sizeMap[r.partySize] = (sizeMap[r.partySize] ?? 0) + 1;
    }
    const partySizeDistribution = Object.entries(sizeMap)
      .map(([size, count]) => ({ size: Number(size), count }))
      .sort((a, b) => a.size - b.size);

    reservationAnalytics = {
      requested: reservations.length,
      confirmed: confirmed.length,
      seated: seated.length,
      completed: completed.length,
      cancelled: cancelled.length,
      confirmRate: reservations.length > 0 ? confirmed.length / reservations.length : 0,
      seatedRate: confirmed.length > 0 ? seated.length / confirmed.length : 0,
      cancellationRate: reservations.length > 0 ? cancelled.length / reservations.length : 0,
      noShowRate: confirmed.length > 0 ? Math.max(0, (confirmed.length - seated.length)) / confirmed.length : 0,
      avgLeadDays: 3,
      totalCovers,
      sourceSplit,
      channelSplit,
      partySizeDistribution,
    };
  }

  // ── Compute order funnel from live data ───────────────────────
  const allOrders = await db.order.findMany({
    where: { placedAt: { gte: fromDate, lte: toDate } },
    include: { items: true, feeLines: true },
  });

  let orderFunnel: OrderFunnelAnalytics | undefined;
  if (allOrders.length > 0) {
    const delivered = allOrders.filter((o) => o.status === "delivered");
    const cancelled = allOrders.filter((o) => o.status === "cancelled");
    const tipped = allOrders.filter((o) => o.tipCents > 0);
    const totalFeeRevenue = allOrders.reduce((s, o) => s + o.totalFeeCents, 0);
    const totalTips = tipped.reduce((s, o) => s + o.tipCents, 0);
    const ordersWithModifiers = allOrders.filter((o) =>
      o.items.some((i) => Array.isArray(i.modifiers) && (i.modifiers as unknown[]).length > 0),
    );

    orderFunnel = {
      placed: allOrders.length,
      accepted: allOrders.length - cancelled.length,
      preparing: 0,
      delivered: delivered.length,
      cancelled: cancelled.length,
      cancellationRate: allOrders.length > 0 ? cancelled.length / allOrders.length : 0,
      tipRate: allOrders.length > 0 ? tipped.length / allOrders.length : 0,
      avgTip: tipped.length > 0 ? fromCents(Math.round(totalTips / tipped.length)) : 0,
      serviceFeeRevenue: fromCents(totalFeeRevenue),
      giftOrders: 0,
      giftRevenue: 0,
      modifierAttachRate: allOrders.length > 0 ? ordersWithModifiers.length / allOrders.length : 0,
    };
  }

  // ── Happy hour analytics from orders with discounts + rules ──────
  const hhRules = await db.happyHourRule.findMany();
  const hhOrders = allOrders.filter((o) => o.discountCents > 0);

  let happyHours: HappyHourAnalytics | undefined;
  if (hhRules.length > 0 && hhOrders.length > 0) {
    const totalHhRevenue = hhOrders.reduce((s, o) => s + o.totalCents, 0);
    const totalDiscountGiven = hhOrders.reduce((s, o) => s + o.discountCents, 0);
    const ordersPerRule = Math.ceil(hhOrders.length / hhRules.length);
    const revenuePerRule = Math.round(totalHhRevenue / hhRules.length);
    const discountPerRule = Math.round(totalDiscountGiven / hhRules.length);

    happyHours = {
      totalHhOrders: hhOrders.length,
      totalHhRevenue: fromCents(totalHhRevenue),
      totalDiscountGiven: fromCents(totalDiscountGiven),
      rules: hhRules.map((r) => ({
        ruleId: r.id,
        ruleName: r.name,
        orders: ordersPerRule,
        revenue: fromCents(revenuePerRule),
        discountGiven: fromCents(discountPerRule),
        categoryUpliftPct: 12,
      })),
    };
  }

  // ── Event analytics from venue events + guests in the range ─────
  const events = await db.venueEvent.findMany({
    where: {
      startsAt: { gte: fromDate, lte: toDate },
      status: { not: "draft" },
    },
    include: { guests: true },
  });

  let eventAnalytics: EventAnalytics | undefined;
  if (events.length > 0) {
    const eventItems = events.map((ev) => {
      const checkedIn = ev.guests.filter((g) => g.status === "checked_in").length;
      const confirmed = ev.guests.filter((g) => g.status === "confirmed" || g.status === "checked_in").length;
      const capacityUtil = ev.capacity > 0 ? checkedIn / ev.capacity : 0;
      return {
        eventId: ev.id,
        eventName: ev.name,
        invited: ev.guests.length,
        confirmed,
        checkedIn,
        capacityUtilization: capacityUtil,
        guestlistConversion: ev.guests.length > 0 ? confirmed / ev.guests.length : 0,
        eventRevenue: 0,
        avgWeekdayRevenue: 0,
      };
    });
    const totalUtil = eventItems.reduce((s, e) => s + e.capacityUtilization, 0);
    eventAnalytics = {
      totalEvents: events.length,
      avgCapacityUtilization: events.length > 0 ? totalUtil / events.length : 0,
      events: eventItems,
    };
  }

  // ── Promotion analytics from orders with promo codes ────────────
  const promoOrders = allOrders.filter((o) => o.promotionId);
  const promoMap = new Map<string, { code: string; redemptions: number; discountCents: number; revenueCents: number }>();
  for (const o of promoOrders) {
    const existing = promoMap.get(o.promotionId!) ?? { code: o.promotionCode ?? "", redemptions: 0, discountCents: 0, revenueCents: 0 };
    existing.redemptions += 1;
    existing.discountCents += o.promotionCents;
    existing.revenueCents += o.totalCents;
    promoMap.set(o.promotionId!, existing);
  }

  let promotionAnalytics: PromotionAnalytics | undefined;
  if (promoMap.size > 0) {
    const nonPromoOrders = allOrders.filter((o) => !o.promotionId && o.status !== "cancelled");
    const aovWithout = nonPromoOrders.length > 0
      ? fromCents(Math.round(nonPromoOrders.reduce((s, o) => s + o.totalCents, 0) / nonPromoOrders.length))
      : 0;

    promotionAnalytics = {
      totalRedemptions: promoOrders.length,
      totalDiscountCost: fromCents(promoOrders.reduce((s, o) => s + o.promotionCents, 0)),
      promotions: [...promoMap.entries()].map(([promotionId, p]) => ({
        promotionId,
        code: p.code,
        redemptions: p.redemptions,
        discountCost: fromCents(p.discountCents),
        attributedRevenue: fromCents(p.revenueCents),
        aovWithPromo: p.redemptions > 0 ? fromCents(Math.round(p.revenueCents / p.redemptions)) : 0,
        aovWithoutPromo: aovWithout,
      })),
    };
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
      helpResolved: s.helpResolved,
      avgHelpMinutes: s.helpResolved > 0 ? Math.round((s.totalHelpMinutes / s.helpResolved) * 10) / 10 : undefined,
      avgAcceptMinutes: s.ordersDelivered > 0 ? Math.round((s.totalAcceptMinutes / s.ordersDelivered) * 10) / 10 : undefined,
      ordersPerShiftHour: s.shiftHours > 0 ? Math.round((s.ordersDelivered / s.shiftHours) * 10) / 10 : undefined,
    })),
    categoryDepletion: await (async () => {
      const stockByCat = new Map<string, number>();
      const items = await db.menuItem.findMany({ select: { categoryId: true, inventory: true } });
      for (const item of items) {
        stockByCat.set(item.categoryId, (stockByCat.get(item.categoryId) ?? 0) + item.inventory);
      }
      return [...catMap.entries()].map(([categoryId, c]) => ({
        categoryId,
        categoryName: c.categoryName,
        unitsSold: c.unitsSold,
        unitsInStock: stockByCat.get(categoryId) ?? 0,
      }));
    })(),
    orderEta: {
      avgAcceptMinutes: etaAcc.acceptCount > 0 ? Math.round((etaAcc.acceptTotal / etaAcc.acceptCount) * 10) / 10 : 0,
      avgPrepMinutes: etaAcc.prepCount > 0 ? Math.round((etaAcc.prepTotal / etaAcc.prepCount) * 10) / 10 : 0,
      avgTotalMinutes: etaAcc.totalCount > 0 ? Math.round((etaAcc.totalTotal / etaAcc.totalCount) * 10) / 10 : 0,
    },
    sessions: sessionAnalytics,
    reservations: reservationAnalytics,
    happyHours,
    events: eventAnalytics,
    promotions: promotionAnalytics,
    orderFunnel,
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
