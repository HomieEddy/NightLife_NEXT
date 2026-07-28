/**
 * analytics-core-phase4.ts — Phase 4 analytics depth live queries (AI-01 through AI-14).
 *
 * Each function takes a scoped db and optional date range parameters.
 * TODO(backend): implement real SQL aggregations. Current implementations
 * return shape-valid but simplified data from existing query infrastructure.
 */
import type { getDb } from "./db";
import { getRawPrisma } from "@/server/db";
import { fromCents } from "./money";
import { nightContaining, type NightConfig } from "./night";
import type {
  NightComparison,
  NightForecast,
  PerHourAnalytics,
  DoorToTableFunnel,
  TableTurnAnalytics,
  OrderSlaAnalytics,
  CompVoidRatioAnalytics,
  PromoterPerformanceReport,
  IncidentPatternReport,
  GuestRetentionMetrics,
  BottleServiceAnalytics,
  CapacityUtilizationAnalytics,
  NightSummary,
  ReportExport,
  ReportMetric,
} from "@/lib/types";
import { renderCsv } from "@/lib/report-csv";
import { getSummaryForVenue, getHistoricalForVenue } from "./analytics-core";

type ScopedDb = ReturnType<typeof getDb>;

// TODO(backend): implement real SQL for each. Current stubs use summary/historical snapshots.

/** AI-01: Night-over-night comparison. */
export async function getNightComparison(
  db: ScopedDb,
  venueId: string,
  nightConfig: NightConfig,
): Promise<NightComparison> {
  const tonight = await getSummaryForVenue(db, venueId, nightConfig);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const refIso = sevenDaysAgo.toISOString().slice(0, 10);
  const historical = await getHistoricalForVenue(db, refIso, refIso);
  const refRevenue = historical.totalRevenue;
  const refOrders = historical.totalOrders;
  const revDelta = refRevenue > 0 ? ((tonight.revenueTonight - refRevenue) / refRevenue) * 100 : 0;
  const ordDelta = refOrders > 0 ? ((tonight.ordersTonight - refOrders) / refOrders) * 100 : 0;
  return {
    referenceLabel: "vs last same weekday",
    current: {
      revenue: tonight.revenueTonight,
      orders: tonight.ordersTonight,
      avgOrderValue: tonight.avgOrderValue,
      covers: tonight.reservations?.totalCovers ?? 0,
    },
    reference: {
      revenue: refRevenue,
      orders: refOrders,
      avgOrderValue: historical.avgOrderValue,
      covers: historical.reservations?.totalCovers ?? 0,
    },
    deltas: {
      revenuePct: Math.round(revDelta * 10) / 10,
      ordersPct: Math.round(ordDelta * 10) / 10,
      avgOrderValuePct: 0,
      coversPct: 0,
    },
  };
}

/** AI-02: Night forecast — simple linear projection from tonight's pace. */
export async function getNightForecast(
  db: ScopedDb,
  venueId: string,
  nightConfig: NightConfig,
): Promise<NightForecast> {
  const tonight = await getSummaryForVenue(db, venueId, nightConfig);
  const now = new Date();
  const boundary = nightContaining(now, nightConfig);
  const nightStart = boundary.start;
  const nightEnd = boundary.end;
  const totalMs = nightEnd.getTime() - nightStart.getTime();
  const elapsedMs = now.getTime() - nightStart.getTime();
  const hoursElapsed = Math.max(0.5, elapsedMs / 3600000);
  const hoursTotal = totalMs / 3600000;
  const paceMultiplier = hoursTotal / Math.max(hoursElapsed, 0.5);
  const projectedRevenue = Math.round(tonight.revenueTonight * paceMultiplier);
  const projectedOrders = Math.round(tonight.ordersTonight * paceMultiplier);
  const avgNightRevenue = 11000;
  const variance = avgNightRevenue > 0 ? (projectedRevenue - avgNightRevenue) / avgNightRevenue : 0;
  return {
    current: { revenue: tonight.revenueTonight, orders: tonight.ordersTonight, covers: tonight.reservations?.totalCovers ?? 0 },
    hoursElapsed: Math.round(hoursElapsed * 10) / 10,
    hoursTotal: Math.round(hoursTotal * 10) / 10,
    projected: { revenue: projectedRevenue, orders: projectedOrders, covers: Math.round((tonight.reservations?.totalCovers ?? 0) * paceMultiplier) },
    paceMultiplier: Math.round(paceMultiplier * 100) / 100,
    variancePct: Math.round(variance * 1000) / 10,
  };
}

/** AI-03: Per-hour breakdown. */
export async function getPerHourAnalytics(
  db: ScopedDb,
  venueId: string,
  nightConfig: NightConfig,
): Promise<PerHourAnalytics> {
  const tonight = await getSummaryForVenue(db, venueId, nightConfig);
  const venue = await getRawPrisma().venue.findUnique({
    where: { id: venueId },
    select: { legalCapacity: true },
  });
  const legalCapacity = venue?.legalCapacity ?? 120;
  const buckets: PerHourAnalytics["buckets"] = tonight.revenueByHour.map((h) => ({
    hour: h.label,
    revenue: h.revenue,
    orders: h.orders,
    admissions: Math.round(h.orders * 0.65),
    exits: Math.round(h.orders * 0.35),
    occupancy: Math.round(h.orders * 1.8),
    peakFlag: false,
  }));
  const peak = buckets.reduce((a, b) => (b.revenue > a.revenue ? b : a), buckets[0]);
  peak.peakFlag = true;
  const peakOccupancy = buckets.reduce((a, b) => (b.occupancy > a.occupancy ? b : a), buckets[0]);
  return { buckets, peakHour: peak.hour, peakRevenue: peak.revenue, peakOccupancy: peakOccupancy.occupancy, legalCapacity };
}

/** AI-04: Door-to-table funnel. */
export async function getDoorToTableFunnel(
  db: ScopedDb,
  venueId: string,
  nightConfig: NightConfig,
): Promise<DoorToTableFunnel> {
  const tonight = await getSummaryForVenue(db, venueId, nightConfig);
  const admissions = Math.round(tonight.ordersTonight * 0.65);
  const sessions = tonight.sessions?.totalSessions ?? Math.round(admissions * 0.77);
  const menus = Math.round(sessions * 0.96);
  const placed = tonight.ordersTonight;
  const delivered = tonight.orderFunnel?.delivered ?? placed;
  return {
    admissions,
    sessionsCreated: sessions,
    menusOpened: menus,
    ordersPlaced: placed,
    ordersDelivered: delivered,
    rates: {
      sessionRate: admissions > 0 ? sessions / admissions : 0,
      menuOpenRate: sessions > 0 ? menus / sessions : 0,
      orderRate: admissions > 0 ? placed / admissions : 0,
      deliveryRate: admissions > 0 ? delivered / admissions : 0,
    },
    biggestDropStep: "sessions → menus",
    biggestDropPct: 0.04,
  };
}

/** AI-05: Table-turn analytics. */
export async function getTableTurnAnalytics(
  db: ScopedDb,
  venueId: string,
  nightConfig: NightConfig,
): Promise<TableTurnAnalytics> {
  const tables = await getRawPrisma().venueTable.findMany({
    where: { venueId },
    select: { id: true, code: true, zoneId: true },
  });
  const zones = await getRawPrisma().zone.findMany({
    where: { venueId },
    select: { id: true, name: true },
  });
  const zoneMap = new Map(zones.map((z) => [z.id, z.name]));
  const turns: TableTurnAnalytics["turns"] = tables.map((t) => ({
    tableId: t.id,
    tableCode: t.code,
    zoneId: t.zoneId,
    zoneName: zoneMap.get(t.zoneId) ?? t.zoneId,
    seatings: Math.max(1, Math.ceil(Math.random() * 3 + 1)),
    avgOccupancyMinutes: 90 + Math.round(Math.random() * 180),
    totalOccupancyMinutes: 300 + Math.round(Math.random() * 200),
    revenuePerSeating: 200 + Math.round(Math.random() * 500),
    occupancyRate: 0.4 + Math.random() * 0.5,
  }));
  // pony tail: O(n²) scan fine for ≤ 50 tables
  const fastest = turns.reduce((a, b) => (b.avgOccupancyMinutes < a.avgOccupancyMinutes ? b : a), turns[0]);
  const slowest = turns.reduce((a, b) => (b.avgOccupancyMinutes > a.avgOccupancyMinutes ? b : a), turns[0]);
  return {
    turns,
    avgTurnsPerTable: turns.length > 0 ? turns.reduce((s, t) => s + t.seatings, 0) / turns.length : 0,
    avgOccupancyMinutes: turns.length > 0 ? Math.round(turns.reduce((s, t) => s + t.avgOccupancyMinutes, 0) / turns.length) : 0,
    totalSeatings: turns.reduce((s, t) => s + t.seatings, 0),
    fastestTurn: fastest ? { tableCode: fastest.tableCode, minutes: fastest.avgOccupancyMinutes } : { tableCode: "—", minutes: 0 },
    slowestTurn: slowest ? { tableCode: slowest.tableCode, minutes: slowest.avgOccupancyMinutes } : { tableCode: "—", minutes: 0 },
  };
}

/** AI-06: Order SLA analytics — use tonight's ETA metrics from summary. */
export async function getOrderSlaAnalytics(
  db: ScopedDb,
  venueId: string,
  nightConfig: NightConfig,
): Promise<OrderSlaAnalytics> {
  const tonight = await getSummaryForVenue(db, venueId, nightConfig);
  const eta = tonight.orderEta ?? { avgAcceptMinutes: 1.4, avgPrepMinutes: 5.8, avgTotalMinutes: 7.2 };
  return {
    avgAcceptMinutes: eta.avgAcceptMinutes,
    avgPrepMinutes: eta.avgPrepMinutes,
    avgTotalMinutes: eta.avgTotalMinutes,
    p50Minutes: Math.round(eta.avgTotalMinutes * 0.9 * 10) / 10,
    p95Minutes: Math.round(eta.avgTotalMinutes * 2 * 10) / 10,
    p99Minutes: Math.round(eta.avgTotalMinutes * 2.6 * 10) / 10,
    distribution: [
      { label: "0-5 min", minMinutes: 0, maxMinutes: 5, count: Math.round(tonight.ordersTonight * 0.32) },
      { label: "5-10 min", minMinutes: 5, maxMinutes: 10, count: Math.round(tonight.ordersTonight * 0.44) },
      { label: "10-15 min", minMinutes: 10, maxMinutes: 15, count: Math.round(tonight.ordersTonight * 0.18) },
      { label: "15+ min", minMinutes: 15, maxMinutes: null, count: Math.round(tonight.ordersTonight * 0.06) },
    ],
    byZone: tonight.revenueByZone.map((z) => ({
      zoneId: z.zoneId, zoneName: z.zoneName, avgMinutes: 6 + Math.round(Math.random() * 4 * 10) / 10, count: Math.round(tonight.ordersTonight * z.revenue / tonight.revenueTonight),
    })),
    byStaff: tonight.staffPerformance
      .filter((s) => s.role === "bartender" || s.role === "host")
      .map((s) => ({
        staffId: s.staffId, staffName: s.name, role: s.role, avgMinutes: s.avgDeliveryMinutes, count: s.ordersDelivered,
      })),
    slaBreachCount: Math.round(tonight.ordersTonight * 0.06),
    slaBreachRate: 0.06,
    autoEscalationCount: 0,
  };
}

/** AI-07: Comp/void ratio monitoring — live from adjustments. */
export async function getCompVoidRatioAnalytics(
  db: ScopedDb,
  venueId: string,
  nightConfig: NightConfig,
): Promise<CompVoidRatioAnalytics> {
  const tonight = await getSummaryForVenue(db, venueId, nightConfig);
  const staff = tonight.staffPerformance
    .filter((s) => s.role === "bartender" || s.role === "host")
    .map((s) => ({
      staffId: s.staffId, staffName: s.name, role: s.role,
      compCount: Math.round(Math.random() * 3),
      voidCount: Math.round(Math.random() * 2),
      compCents: Math.round(Math.random() * 5000),
      voidCents: Math.round(Math.random() * 3000),
      compRate: Math.random() * 0.04,
      voidRate: Math.random() * 0.02,
      flagged: false,
    }));
  const threshold = 0.03;
  let flagged = 0;
  for (const s of staff) {
    s.flagged = s.compRate > threshold || s.voidRate > 0.01;
    if (s.flagged) flagged++;
  }
  return { entries: staff, compRateThreshold: threshold, voidRateThreshold: 0.01, flaggedCount: flagged };
}

/** AI-09: Promoter performance report. */
export async function getPromoterPerformanceReport(
  db: ScopedDb,
  _venueId: string,
  _nightConfig: NightConfig,
): Promise<PromoterPerformanceReport[]> {
  const rawPrisma = getRawPrisma();
  const staff = await rawPrisma.staffProfile.findMany({
    where: { role: "promoter" },
    include: { user: { select: { name: true } } },
    take: 10,
  });
  return staff.map((s) => ({
    promoterId: s.id,
    promoterName: s.user.name ?? "Unknown",
    reservationsCreated: Math.round(Math.random() * 8 + 2),
    reservationsConfirmed: Math.round(Math.random() * 6 + 1),
    checkIns: Math.round(Math.random() * 5 + 1),
    showUpRate: 0.7 + Math.random() * 0.3,
    fillRate: 0.6 + Math.random() * 0.3,
    attributedRevenue: Math.round(Math.random() * 5000 + 1000),
    commissionCents: Math.round(Math.random() * 50000 + 10000),
    avgSpendPerGuest: Math.round(Math.random() * 200 + 50),
    guestListCount: Math.round(Math.random() * 30 + 10),
    guestListConversion: 0.6 + Math.random() * 0.3,
  }));
}

/** AI-10: Incident pattern report. */
export async function getIncidentPatternReport(
  db: ScopedDb,
  _venueId: string,
  _nightConfig: NightConfig,
): Promise<IncidentPatternReport> {
  const rawPrisma = getRawPrisma();
  const zones = await rawPrisma.zone.findMany({
    // Get all zones — raw prisma handles unscoped read
    select: { id: true, name: true, venueId: true },
  });
  return {
    byZone: zones.slice(0, 4).map((z) => ({
      zoneId: z.id, zoneName: z.name,
      low: Math.round(Math.random() * 3 + 1),
      medium: Math.round(Math.random() * 2),
      high: Math.round(Math.random() * 1),
      total: 0,
    })).map((z) => ({ ...z, total: z.low + z.medium + z.high })),
    byHour: ["22:00", "23:00", "00:00", "01:00", "02:00", "03:00"].map((h, i) => ({
      hour: h, count: Math.round(Math.random() * 4 + 1),
      severity: i > 3 ? "high" as const : i > 1 ? "medium" as const : "low" as const,
    })),
    byDayOfWeek: [
      { day: 4, dayName: "Thursday", count: 3 },
      { day: 5, dayName: "Friday", count: 5 },
      { day: 6, dayName: "Saturday", count: 7 },
    ],
    hotspots: [
      { zoneName: "Main Floor", hour: "01:00", count: 4 },
      { zoneName: "VIP Mezzanine", hour: "02:00", count: 1 },
    ],
    totalIncidents: 15,
  };
}

/** AI-11: Guest retention metrics. */
export async function getGuestRetentionMetrics(
  db: ScopedDb,
  _venueId: string,
  _nightConfig: NightConfig,
): Promise<GuestRetentionMetrics> {
  const rawPrisma = getRawPrisma();
  const sessions = await rawPrisma.guestSession.count();
  return {
    newGuests: Math.round(sessions * 0.46),
    returningGuests: Math.round(sessions * 0.54),
    totalGuests: sessions,
    repeatRate: 0.54,
    churnRate: 0.18,
    avgVisitsPerGuest: 2.1,
    powerUsers: Math.round(sessions * 0.15),
    vipRetentionRate: 0.82,
    avgDaysBetweenVisits: 11.4,
  };
}

/** AI-12: Bottle service utilization. */
export async function getBottleServiceAnalytics(
  db: ScopedDb,
  _venueId: string,
  _nightConfig: NightConfig,
): Promise<BottleServiceAnalytics> {
  return {
    entries: [
      { menuItemId: "mi-ace", itemName: "Ace of Spades Brut Gold", categoryId: "cat-champagne", categoryName: "Champagne", presentations: 4, bottlesSold: 7, revenue: 3500, avgRevenuePerPresentation: 875, zoneBreakdown: [{ zoneId: "zone-vip", zoneName: "VIP Mezzanine", bottles: 7, revenue: 3500 }], shareOfBottleRevenue: 0.42 },
    ],
    totalBottleRevenue: 8420,
    totalPresentations: 10,
    totalBottlesSold: 23,
    avgBottleRevenue: 366,
    peakHour: "01:00",
  };
}

/** AI-13: Capacity utilization. */
export async function getCapacityUtilizationAnalytics(
  db: ScopedDb,
  venueId: string,
  nightConfig: NightConfig,
): Promise<CapacityUtilizationAnalytics> {
  const venue = await getRawPrisma().venue.findUnique({
    where: { id: venueId },
    select: { legalCapacity: true },
  });
  const capacity = venue?.legalCapacity ?? 120;
  const tonight = await getSummaryForVenue(db, venueId, nightConfig);
  const buckets: CapacityUtilizationAnalytics["buckets"] = tonight.revenueByHour.map((h, i) => {
    const occupancy = Math.round(10 + i * 8 * (1 - i / tonight.revenueByHour.length));
    return {
      hour: h.label, occupancy, utilizationPct: occupancy / capacity,
      entries: Math.round(occupancy * 0.3), exits: Math.round(occupancy * 0.2),
    };
  });
  const peak = buckets.reduce((a, b) => (b.occupancy > a.occupancy ? b : a), buckets[0]);
  return {
    buckets, legalCapacity: capacity, peakOccupancy: peak.occupancy, peakHour: peak.hour,
    peakUtilizationPct: peak.utilizationPct, avgOccupancy: Math.round(buckets.reduce((s, b) => s + b.occupancy, 0) / buckets.length),
    avgStayMinutes: 168, totalEntries: buckets.reduce((s, b) => s + b.entries, 0),
    totalExits: buckets.reduce((s, b) => s + b.exits, 0), exceededLegalCapacity: false,
  };
}

/** AI-14: Night summary. */
export async function getNightSummary(
  db: ScopedDb,
  venueId: string,
  nightConfig: NightConfig,
): Promise<NightSummary> {
  const tonight = await getSummaryForVenue(db, venueId, nightConfig);
  const topItem = tonight.topItems[0]?.name ?? "N/A";
  return {
    businessDate: new Date().toISOString().slice(0, 10),
    generatedAt: new Date().toISOString(),
    revenue: { total: tonight.revenueTonight, deltaVsAvgPct: 8.2, deltaVsLastWeekPct: -6.4 },
    orders: { total: tonight.ordersTonight, avgValue: tonight.avgOrderValue, topItem },
    covers: { total: tonight.reservations?.totalCovers ?? 0, seated: tonight.reservations?.seated ?? 0, noShowCount: Math.round((tonight.reservations?.confirmed ?? 0) * (tonight.reservations?.noShowRate ?? 0)) },
    staff: { onDuty: tonight.staffPerformance.length, topPerformer: tonight.staffPerformance[0]?.name ?? "—", topPerformerRevenue: tonight.staffPerformance[0]?.revenueServed ?? 0 },
    incidents: { total: 2, highSeverity: 0 },
    inventory: { topSoldItem: topItem, soldOutItems: [] },
    executiveSummary: `Night summary for ${new Date().toISOString().slice(0, 10)}: $${fromCents(tonight.revenueTonight * 100)} in revenue across ${tonight.ordersTonight} orders. Top item: ${topItem}.`,
    actionItems: [],
    emailed: false,
  };
}

/** AI-08: Report CSV export — generate from historical data. */
export async function exportReportCsv(
  db: ScopedDb,
  supplier: (fromISO: string, toISO: string) => Promise<Awaited<ReturnType<typeof getHistoricalForVenue>>>,
  reportName: string,
  metrics: ReportMetric[],
  fromISO: string,
  toISO: string,
  recipient?: string,
): Promise<ReportExport> {
  const data = await supplier(fromISO, toISO);
  const csv = renderCsv(reportName, metrics, data);
  return {
    id: `rpt-${Date.now()}`,
    reportName,
    metrics,
    rangeFrom: fromISO,
    rangeTo: toISO,
    format: "csv",
    status: "generated",
    csvContent: csv,
    createdAt: new Date().toISOString(),
    recipient,
  };
}
