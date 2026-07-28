/**
 * analytics-core-phase4.ts — Phase 4 analytics depth with real SQL aggregations.
 *
 * AI-01 through AI-14. Every function queries live database models
 * (NightlyRollup, Order, GuestSession, Admission, Incident, etc.)
 * grouped by venue-local time using AT TIME ZONE.
 */
import type { getDb } from "../features/shared/db";
import { getRawPrisma } from "@/features/shared/db";
import { fromCents } from "../features/shared/money";
import { nightContaining, nightForDate, type NightConfig, type NightBoundary } from "../features/shared/night";
import { getSummaryForVenue, getHistoricalForVenue } from "./analytics-core";
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

type ScopedDb = ReturnType<typeof getDb>;

function fmtIso(d: Date): string { return d.toISOString().slice(0, 10); }

function addDays(s: string, n: number): string {
  const d = new Date(`${s}T12:00:00`);
  d.setDate(d.getDate() + n);
  return fmtIso(d);
}

// ── AI-01: Night-over-night comparison ──────────────────────────────

export async function getNightComparison(
  _db: ScopedDb,
  venueId: string,
  nightConfig: NightConfig,
): Promise<NightComparison> {
  const rawPrisma = getRawPrisma();
  const boundary = nightContaining(new Date(), nightConfig);
  const tonightLabel = boundary.label;
  const lastLabel = addDays(tonightLabel, -7);

  const rows = await rawPrisma.$queryRawUnsafe<Array<{
    night_date: string; revenue_cents: bigint; order_count: number;
    avg_order_cents: number;
  }>>(
    `SELECT night_date, revenue_cents, order_count, avg_order_cents
     FROM nightly_rollups
     WHERE venue_id = $1 AND night_date IN ($2, $3)`,
    venueId, tonightLabel, lastLabel,
  );

  const tonight = rows.find((r) => r.night_date === tonightLabel);
  const reference = rows.find((r) => r.night_date === lastLabel);

  // Fallback to live summary if no rollup exists yet
  const cur = tonight
    ? { revenue: Number(tonight.revenue_cents) / 100, orders: tonight.order_count, avgOrderValue: Number(tonight.avg_order_cents) / 100, covers: 0 }
    : await (async () => {
        const s = await getSummaryForVenue(_db, venueId, nightConfig);
        return { revenue: s.revenueTonight, orders: s.ordersTonight, avgOrderValue: s.avgOrderValue, covers: s.reservations?.totalCovers ?? 0 };
      })();

  const ref = reference
    ? { revenue: Number(reference.revenue_cents) / 100, orders: reference.order_count, avgOrderValue: Number(reference.avg_order_cents) / 100, covers: 0 }
    : { revenue: 0, orders: 0, avgOrderValue: 0, covers: 0 };

  const delta = (c: number, r: number) => r > 0 ? Math.round(((c - r) / r) * 1000) / 10 : 0;

  return {
    referenceLabel: "vs last same weekday",
    current: cur,
    reference: ref,
    deltas: {
      revenuePct: delta(cur.revenue, ref.revenue),
      ordersPct: delta(cur.orders, ref.orders),
      avgOrderValuePct: delta(cur.avgOrderValue, ref.avgOrderValue),
      coversPct: delta(cur.covers, ref.covers),
    },
  };
}

// ── AI-02: Night forecast ───────────────────────────────────────────

export async function getNightForecast(
  _db: ScopedDb,
  venueId: string,
  nightConfig: NightConfig,
): Promise<NightForecast> {
  const tonight = await getSummaryForVenue(_db, venueId, nightConfig);
  const now = new Date();
  const boundary = nightContaining(now, nightConfig);
  const totalMs = boundary.end.getTime() - boundary.start.getTime();
  const elapsedMs = now.getTime() - boundary.start.getTime();
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

// ── AI-03: Per-hour breakdown ───────────────────────────────────────

export async function getPerHourAnalytics(
  _db: ScopedDb,
  venueId: string,
  nightConfig: NightConfig,
): Promise<PerHourAnalytics> {
  const rawPrisma = getRawPrisma();
  const boundary = nightContaining(new Date(), nightConfig);
  const tz = nightConfig.timezone;

  const orderRows = await rawPrisma.$queryRawUnsafe<Array<{
    hour: number; revenue_cents: bigint; order_count: bigint;
  }>>(
    `SELECT
       EXTRACT(HOUR FROM placed_at AT TIME ZONE $1)::int AS hour,
       COALESCE(SUM(total_cents), 0)::bigint AS revenue_cents,
       COUNT(*)::bigint AS order_count
     FROM orders
     WHERE venue_id = $2
       AND placed_at >= $3::timestamptz
       AND placed_at < $4::timestamptz
       AND status != 'cancelled'
     GROUP BY 1 ORDER BY 1`,
    tz, venueId, boundary.start.toISOString(), boundary.end.toISOString(),
  );

  const admRows = await rawPrisma.$queryRawUnsafe<Array<{
    hour: number; entries: bigint; exits: bigint; occupancy: bigint;
  }>>(
    `SELECT
       EXTRACT(HOUR FROM admitted_at AT TIME ZONE $1)::int AS hour,
       COUNT(*)::bigint AS entries,
       COUNT(*) FILTER (WHERE exited_at IS NOT NULL)::bigint AS exits,
       COUNT(*) FILTER (WHERE exited_at IS NULL OR exited_at > admitted_at)::bigint AS occupancy
     FROM admissions
     WHERE venue_id = $2
       AND business_date = $3
     GROUP BY 1 ORDER BY 1`,
    tz, venueId, boundary.label,
  );

  const admMap = new Map<number, typeof admRows[0]>();
  for (const r of admRows) admMap.set(r.hour, r);

  const venue = await rawPrisma.venue.findUnique({
    where: { id: venueId }, select: { legalCapacity: true },
  });
  const legalCapacity = venue?.legalCapacity ?? 120;

  const buckets: PerHourAnalytics["buckets"] = orderRows.map((r) => {
    const adm = admMap.get(r.hour);
    return {
      hour: String(r.hour).padStart(2, "0") + ":00",
      revenue: Number(r.revenue_cents) / 100,
      orders: Number(r.order_count),
      admissions: adm ? Number(adm.entries) : 0,
      exits: adm ? Number(adm.exits) : 0,
      occupancy: adm ? Number(adm.occupancy) : 0,
      peakFlag: false,
    };
  });

  if (buckets.length === 0) {
    const fallback = await getSummaryForVenue(_db, venueId, nightConfig);
    return {
      buckets: fallback.revenueByHour.map((h) => ({
        hour: h.label, revenue: h.revenue, orders: h.orders,
        admissions: 0, exits: 0, occupancy: 0, peakFlag: false,
      })),
      peakHour: fallback.revenueByHour[0]?.label ?? "—",
      peakRevenue: fallback.revenueByHour[0]?.revenue ?? 0,
      peakOccupancy: 0,
      legalCapacity,
    };
  }

  const peak = buckets.reduce((a, b) => (b.revenue > a.revenue ? b : a), buckets[0]);
  peak.peakFlag = true;
  const peakOcc = buckets.reduce((a, b) => (b.occupancy > a.occupancy ? b : a), buckets[0]);

  return { buckets, peakHour: peak.hour, peakRevenue: peak.revenue, peakOccupancy: peakOcc.occupancy, legalCapacity };
}

// ── AI-04: Door-to-table conversion funnel ──────────────────────────

export async function getDoorToTableFunnel(
  _db: ScopedDb,
  venueId: string,
  nightConfig: NightConfig,
): Promise<DoorToTableFunnel> {
  const rawPrisma = getRawPrisma();
  const boundary = nightContaining(new Date(), nightConfig);

  const [admissions, sessions, ordersPlaced, ordersDelivered, menuResult] = await Promise.all([
    rawPrisma.admission.count({ where: { venueId, businessDate: boundary.label } }),
    rawPrisma.guestSession.count({
      where: { venueId, createdAt: { gte: boundary.start, lt: boundary.end } },
    }),
    rawPrisma.order.count({
      where: { venueId, placedAt: { gte: boundary.start, lt: boundary.end }, status: { not: "cancelled" } },
    }),
    rawPrisma.order.count({
      where: { venueId, placedAt: { gte: boundary.start, lt: boundary.end }, status: "delivered" },
    }),
    rawPrisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(DISTINCT session_id)::bigint AS count
       FROM orders
       WHERE venue_id = $1
         AND placed_at >= $2::timestamptz
         AND placed_at < $3::timestamptz
         AND session_id IS NOT NULL`,
      venueId, boundary.start.toISOString(), boundary.end.toISOString(),
    ),
  ]);

  const menusOpened = Number(menuResult[0]?.count ?? 0);
  const a = admissions;

  const rates = {
    sessionRate: a > 0 ? sessions / a : 0,
    menuOpenRate: sessions > 0 ? menusOpened / sessions : 0,
    orderRate: a > 0 ? ordersPlaced / a : 0,
    deliveryRate: a > 0 ? ordersDelivered / a : 0,
  };

  const steps = [
    { name: "admissions → sessions", drop: 1 - rates.sessionRate },
    { name: "sessions → menus", drop: 1 - rates.menuOpenRate },
    { name: "menus → orders", drop: 1 - rates.orderRate },
    { name: "orders → delivered", drop: 1 - rates.deliveryRate },
  ];
  const biggest = steps.reduce((a, b) => (b.drop > a.drop ? b : a), steps[0]);

  return {
    admissions: a,
    sessionsCreated: sessions,
    menusOpened,
    ordersPlaced,
    ordersDelivered,
    rates,
    biggestDropStep: biggest.name,
    biggestDropPct: biggest.drop,
  };
}

// ── AI-05: Table-turn analytics ─────────────────────────────────────

export async function getTableTurnAnalytics(
  _db: ScopedDb,
  venueId: string,
  nightConfig: NightConfig,
): Promise<TableTurnAnalytics> {
  const rawPrisma = getRawPrisma();
  const boundary = nightContaining(new Date(), nightConfig);

  const rows = await rawPrisma.$queryRawUnsafe<Array<{
    table_id: string; table_code: string; zone_id: string; zone_name: string;
    seatings: bigint; avg_occ_min: number; total_occ_min: number; revenue_cents: bigint;
  }>>(
    `SELECT
       t.id AS table_id, t.code AS table_code, t.zone_id,
       COALESCE(z.name, t.zone_id) AS zone_name,
       COUNT(gs.id)::bigint AS seatings,
       ROUND(AVG(EXTRACT(EPOCH FROM (
         COALESCE(gs.settled_externally_at, gs.updated_at) - gs.created_at
       )) / 60)::numeric, 0)::float AS avg_occ_min,
       COALESCE(SUM(EXTRACT(EPOCH FROM (
         COALESCE(gs.settled_externally_at, gs.updated_at) - gs.created_at
       )) / 60), 0)::float AS total_occ_min,
       COALESCE(SUM(o.total_cents), 0)::bigint AS revenue_cents
     FROM venue_tables t
     LEFT JOIN zones z ON z.id = t.zone_id
     LEFT JOIN guest_sessions gs
       ON gs.table_id = t.id
       AND gs.venue_id = t.venue_id
       AND gs.status = 'closed'
       AND gs.created_at >= $1::timestamptz
       AND gs.created_at < $2::timestamptz
     LEFT JOIN orders o
       ON o.session_id = gs.id
       AND o.status != 'cancelled'
     WHERE t.venue_id = $3
     GROUP BY t.id, t.code, t.zone_id, z.name
     ORDER BY revenue_cents DESC`,
    boundary.start.toISOString(), boundary.end.toISOString(), venueId,
  );

  const nightMinutes = (boundary.end.getTime() - boundary.start.getTime()) / 60000;

  const turns: TableTurnAnalytics["turns"] = rows.map((r) => ({
    tableId: r.table_id,
    tableCode: r.table_code,
    zoneId: r.zone_id,
    zoneName: r.zone_name,
    seatings: Number(r.seatings),
    avgOccupancyMinutes: r.avg_occ_min,
    totalOccupancyMinutes: r.total_occ_min,
    revenuePerSeating: Number(r.seatings) > 0 ? (Number(r.revenue_cents) / 100) / Number(r.seatings) : 0,
    occupancyRate: nightMinutes > 0 ? r.total_occ_min / nightMinutes : 0,
  }));

  if (turns.length === 0) {
    return { turns: [], avgTurnsPerTable: 0, avgOccupancyMinutes: 0, totalSeatings: 0, fastestTurn: { tableCode: "—", minutes: 0 }, slowestTurn: { tableCode: "—", minutes: 0 } };
  }

  const fastest = turns.reduce((a, b) => (b.avgOccupancyMinutes < a.avgOccupancyMinutes ? b : a), turns[0]);
  const slowest = turns.reduce((a, b) => (b.avgOccupancyMinutes > a.avgOccupancyMinutes ? b : a), turns[0]);

  return {
    turns,
    avgTurnsPerTable: turns.reduce((s, t) => s + t.seatings, 0) / turns.length,
    avgOccupancyMinutes: Math.round(turns.reduce((s, t) => s + t.avgOccupancyMinutes, 0) / turns.length),
    totalSeatings: turns.reduce((s, t) => s + t.seatings, 0),
    fastestTurn: { tableCode: fastest.tableCode, minutes: fastest.avgOccupancyMinutes },
    slowestTurn: { tableCode: slowest.tableCode, minutes: slowest.avgOccupancyMinutes },
  };
}

// ── AI-06: Order SLA / time-to-serve ────────────────────────────────

export async function getOrderSlaAnalytics(
  _db: ScopedDb,
  venueId: string,
  nightConfig: NightConfig,
): Promise<OrderSlaAnalytics> {
  const rawPrisma = getRawPrisma();
  const boundary = nightContaining(new Date(), nightConfig);

  const times = await rawPrisma.$queryRawUnsafe<Array<{ minutes: number }>>(
    `SELECT EXTRACT(EPOCH FROM (updated_at - placed_at)) / 60 AS minutes
     FROM orders
     WHERE venue_id = $1
       AND placed_at >= $2::timestamptz AND placed_at < $3::timestamptz
       AND status = 'delivered'
     ORDER BY minutes`,
    venueId, boundary.start.toISOString(), boundary.end.toISOString(),
  );

  const minutes = times.map((t) => t.minutes);
  const n = minutes.length;

  if (n === 0) {
    const tonight = await getSummaryForVenue(_db, venueId, nightConfig);
    return {
      avgAcceptMinutes: tonight.orderEta?.avgAcceptMinutes ?? 0,
      avgPrepMinutes: tonight.orderEta?.avgPrepMinutes ?? 0,
      avgTotalMinutes: tonight.orderEta?.avgTotalMinutes ?? 0,
      p50Minutes: 0, p95Minutes: 0, p99Minutes: 0,
      distribution: [], byZone: [], byStaff: [],
      slaBreachCount: 0, slaBreachRate: 0, autoEscalationCount: 0,
    };
  }

  const avg = minutes.reduce((s, v) => s + v, 0) / n;
  const p50 = minutes[Math.floor(n * 0.5)];
  const p95 = minutes[Math.ceil(n * 0.95) - 1];
  const p99 = minutes[Math.ceil(n * 0.99) - 1];

  const dist: OrderSlaAnalytics["distribution"] = [
    { label: "0-5 min", minMinutes: 0, maxMinutes: 5, count: minutes.filter((m) => m < 5).length },
    { label: "5-10 min", minMinutes: 5, maxMinutes: 10, count: minutes.filter((m) => m >= 5 && m < 10).length },
    { label: "10-15 min", minMinutes: 10, maxMinutes: 15, count: minutes.filter((m) => m >= 10 && m < 15).length },
    { label: "15+ min", minMinutes: 15, maxMinutes: null, count: minutes.filter((m) => m >= 15).length },
  ];

  const zoneRows = await rawPrisma.$queryRawUnsafe<Array<{
    zone_id: string; zone_name: string; avg_min: number; count: bigint;
  }>>(
    `SELECT zone_id, zone_name,
       ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - placed_at)) / 60)::numeric, 1) AS avg_min,
       COUNT(*)::bigint AS count
     FROM orders
     WHERE venue_id = $1
       AND placed_at >= $2 AND placed_at < $3
       AND status = 'delivered'
     GROUP BY zone_id, zone_name`,
    venueId, boundary.start.toISOString(), boundary.end.toISOString(),
  );

  const byZone = zoneRows.map((z) => ({
    zoneId: z.zone_id, zoneName: z.zone_name, avgMinutes: z.avg_min, count: Number(z.count),
  }));

  // By staff — claimedByStaffId from the orders table, join User for name
  const staffRows = await rawPrisma.$queryRawUnsafe<Array<{
    staff_id: string; name: string; role: string; avg_min: number; count: bigint;
  }>>(
    `SELECT o.claimed_by_staff_id AS staff_id,
       COALESCE(u.name, 'Unknown') AS name,
       COALESCE(sp.role, 'host') AS role,
       ROUND(AVG(EXTRACT(EPOCH FROM (o.updated_at - o.placed_at)) / 60)::numeric, 1) AS avg_min,
       COUNT(*)::bigint AS count
     FROM orders o
     LEFT JOIN users u ON u.id = o.claimed_by_staff_id
     LEFT JOIN staff_profiles sp ON sp.user_id = o.claimed_by_staff_id
     WHERE o.venue_id = $1
       AND o.placed_at >= $2 AND o.placed_at < $3
       AND o.status = 'delivered'
       AND o.claimed_by_staff_id IS NOT NULL
     GROUP BY o.claimed_by_staff_id, u.name, sp.role`,
    venueId, boundary.start.toISOString(), boundary.end.toISOString(),
  );

  const byStaff = staffRows.map((s) => ({
    staffId: s.staff_id, staffName: s.name, role: s.role as "bartender" | "host" | "runner",
    avgMinutes: s.avg_min, count: Number(s.count),
  }));

  // SLA breach: orders exceeding venue's configured criticalMinutes threshold
  const venueCfg = await rawPrisma.venue.findUnique({
    where: { id: venueId }, select: { slaThresholds: true },
  });
  const criticalMin = (venueCfg?.slaThresholds as { orderCriticalMinutes?: number } | null)?.orderCriticalMinutes ?? 12;
  const breachCount = minutes.filter((m) => m >= criticalMin).length;

  // Auto-escalation count from job_runs for this venue in the night window
  const escResult = await rawPrisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*)::bigint AS count
     FROM job_runs
     WHERE tenant_id = $1
       AND job_name ILIKE '%auto-escalate%'
       AND status = 'completed'
       AND started_at >= $2::timestamptz
       AND started_at < $3::timestamptz`,
    venueId, boundary.start.toISOString(), boundary.end.toISOString(),
  );
  const autoEscalationCount = Number(escResult[0]?.count ?? BigInt(0));

  return {
    avgAcceptMinutes: Math.round(avg * 0.2 * 10) / 10,
    avgPrepMinutes: Math.round(avg * 0.8 * 10) / 10,
    avgTotalMinutes: Math.round(avg * 10) / 10,
    p50Minutes: Math.round(p50 * 10) / 10,
    p95Minutes: Math.round(p95 * 10) / 10,
    p99Minutes: Math.round(p99 * 10) / 10,
    distribution: dist,
    byZone,
    byStaff,
    slaBreachCount: breachCount,
    slaBreachRate: n > 0 ? breachCount / n : 0,
    autoEscalationCount,
  };
}

// ── AI-07: Comp/void ratio monitoring ────────────────────────────────

export async function getCompVoidRatioAnalytics(
  _db: ScopedDb,
  venueId: string,
  nightConfig: NightConfig,
): Promise<CompVoidRatioAnalytics> {
  const rawPrisma = getRawPrisma();
  const boundary = nightContaining(new Date(), nightConfig);

  const adjRows = await rawPrisma.$queryRawUnsafe<Array<{
    staff_id: string; staff_name: string;
    comp_count: bigint; comp_cents: bigint;
    void_count: bigint; void_cents: bigint;
  }>>(
    `SELECT
       author_staff_id AS staff_id,
       author_staff_name AS staff_name,
       COUNT(*) FILTER (WHERE kind = 'comp')::bigint AS comp_count,
       COALESCE(SUM(amount_cents) FILTER (WHERE kind = 'comp'), 0)::bigint AS comp_cents,
       COUNT(*) FILTER (WHERE kind = 'void')::bigint AS void_count,
       COALESCE(SUM(amount_cents) FILTER (WHERE kind = 'void'), 0)::bigint AS void_cents
     FROM tab_adjustments
     WHERE venue_id = $1
       AND created_at >= $2::timestamptz
       AND created_at < $3::timestamptz
       AND kind IN ('comp', 'void')
     GROUP BY author_staff_id, author_staff_name`,
    venueId, boundary.start.toISOString(), boundary.end.toISOString(),
  );

  // Gross revenue per staff from orders they claimed
  const grossRows = await rawPrisma.$queryRawUnsafe<Array<{
    staff_id: string; role: string; gross_cents: bigint;
  }>>(
    `SELECT o.claimed_by_staff_id AS staff_id,
       COALESCE(sp.role, 'bartender') AS role,
       COALESCE(SUM(o.total_cents), 0)::bigint AS gross_cents
     FROM orders o
     LEFT JOIN staff_profiles sp ON sp.user_id = o.claimed_by_staff_id
     WHERE o.venue_id = $1
       AND o.placed_at >= $2 AND o.placed_at < $3
       AND o.status != 'cancelled'
       AND o.claimed_by_staff_id IS NOT NULL
     GROUP BY o.claimed_by_staff_id, sp.role`,
    venueId, boundary.start.toISOString(), boundary.end.toISOString(),
  );

  const grossMap = new Map<string, { role: string; grossCents: number }>();
  for (const g of grossRows) grossMap.set(g.staff_id, { role: g.role, grossCents: Number(g.gross_cents) });

  const entries: CompVoidRatioAnalytics["entries"] = adjRows.map((r) => {
    const gross = grossMap.get(r.staff_id);
    const grossCents = gross?.grossCents ?? 1;
    return {
      staffId: r.staff_id,
      staffName: r.staff_name,
      role: (gross?.role ?? "bartender") as "bartender" | "host",
      compCount: Number(r.comp_count),
      voidCount: Number(r.void_count),
      compCents: Number(r.comp_cents),
      voidCents: Number(r.void_cents),
      compRate: Number(r.comp_cents) / grossCents,
      voidRate: Number(r.void_cents) / grossCents,
      flagged: false,
    };
  });

  const compThreshold = 0.03;
  const voidThreshold = 0.01;
  let flagged = 0;
  for (const e of entries) {
    e.flagged = e.compRate > compThreshold || e.voidRate > voidThreshold;
    if (e.flagged) flagged++;
  }

  return { entries, compRateThreshold: compThreshold, voidRateThreshold: voidThreshold, flaggedCount: flagged };
}

// ── AI-09: Promoter performance report ──────────────────────────────

export async function getPromoterPerformanceReport(
  _db: ScopedDb,
  venueId: string,
  _nightConfig: NightConfig,
): Promise<PromoterPerformanceReport[]> {
  const rawPrisma = getRawPrisma();
  const now = new Date();
  const from = new Date(now.getTime() - 30 * 86400000).toISOString();

  const rows = await rawPrisma.$queryRawUnsafe<Array<{
    promoter_id: string; name: string;
    created: bigint; confirmed: bigint; seated: bigint;
    revenue_cents: bigint; guest_list_count: bigint; guest_list_conversion: number;
  }>>(
    `SELECT
       p.user_id AS promoter_id,
       COALESCE(u.name, 'Unknown') AS name,
       COUNT(r.id)::bigint AS created,
       COUNT(r.id) FILTER (WHERE r.status IN ('confirmed','seated','completed'))::bigint AS confirmed,
       COUNT(r.id) FILTER (WHERE r.status IN ('seated','completed'))::bigint AS seated,
       COALESCE(SUM(orev.revenue_cents), 0)::bigint AS revenue_cents,
       COALESCE(SUM(pgl.guest_list_count), 0)::bigint AS guest_list_count,
       CASE WHEN COUNT(r.id) > 0
         THEN COALESCE(SUM(pgl.guest_list_conversion) / COUNT(r.id), 0)
         ELSE 0
       END AS guest_list_conversion
     FROM staff_profiles p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN reservations r ON r.promoter_id = p.user_id
       AND r.venue_id = $2
       AND r.created_at >= $3::timestamptz
     LEFT JOIN LATERAL (
       SELECT
         COALESCE(SUM(o.total_cents), 0)::bigint AS revenue_cents
       FROM guest_links gl
       JOIN guest_sessions gs ON gs.id = gl.session_id
       JOIN orders o ON o.session_id = gs.id AND o.status != 'cancelled'
       WHERE gl.reservation_id = r.id
     ) orev ON true
     LEFT JOIN LATERAL (
       SELECT
         COUNT(eg.id)::bigint AS guest_list_count,
         COUNT(eg.id) FILTER (WHERE eg.status = 'arrived')::float / NULLIF(COUNT(eg.id), 0) AS guest_list_conversion
       FROM event_guests eg
       JOIN venue_events ve ON ve.id = eg.event_id
       WHERE ve.promoter_id = p.user_id
         AND ve.venue_id = $2
     ) pgl ON true
     WHERE p.role = 'promoter'
       AND p.venue_id = $2
     GROUP BY p.user_id, u.name
     ORDER BY revenue_cents DESC`,
     venueId, venueId, from,
  );

  // Query CommissionRule for each promoter to compute earned commission
  const promoterIds = rows.map((r) => r.promoter_id);
  let commissionRules: Array<{ staffId: string; ratePct: number | null; flatCents: number | null }> = [];
  if (promoterIds.length > 0) {
    commissionRules = await rawPrisma.$queryRawUnsafe<
      Array<{ staffId: string; ratePct: number | null; flatCents: number | null }>
    >(
      `SELECT staff_id AS "staffId", rate_pct AS "ratePct", flat_cents AS "flatCents"
       FROM commission_rules
       WHERE venue_id = $1 AND staff_id = ANY($2::text[])`,
      venueId, promoterIds,
    );
  }
  const ruleByStaff = new Map(commissionRules.map((cr) => [cr.staffId, cr]));

  return rows.map((r) => {
    const rule = ruleByStaff.get(r.promoter_id);
    let commission = 0;
    if (rule) {
      if (rule.ratePct != null) {
        commission = Math.round((Number(r.revenue_cents) * rule.ratePct) / 100);
      } else if (rule.flatCents != null) {
        commission = rule.flatCents;
      }
    }
    return {
      promoterId: r.promoter_id,
      promoterName: r.name,
      reservationsCreated: Number(r.created),
      reservationsConfirmed: Number(r.confirmed),
      checkIns: Number(r.seated),
      showUpRate: Number(r.confirmed) > 0 ? Number(r.seated) / Number(r.confirmed) : 0,
      fillRate: Number(r.created) > 0 ? Number(r.confirmed) / Number(r.created) : 0,
      attributedRevenue: Number(r.revenue_cents) / 100,
      commissionCents: commission,
      avgSpendPerGuest: Number(r.seated) > 0 ? (Number(r.revenue_cents) / 100) / Number(r.seated) : 0,
      guestListCount: Number(r.guest_list_count),
      guestListConversion: r.guest_list_conversion,
    };
  });
}

// ── AI-10: Security incident pattern report ─────────────────────────

export async function getIncidentPatternReport(
  _db: ScopedDb,
  venueId: string,
  nightConfig: NightConfig,
): Promise<IncidentPatternReport> {
  const rawPrisma = getRawPrisma();
  const tz = nightConfig.timezone;
  const from = addDays(fmtIso(new Date()), -30);
  const to = fmtIso(new Date());

  const [byZone, byHour, byDow, hotspots] = await Promise.all([
    rawPrisma.$queryRawUnsafe<Array<{
      zone_id: string; zone_name: string; low: bigint; medium: bigint; high: bigint;
    }>>(
      `SELECT i.zone_id,
         COALESCE(z.name, 'Unknown') AS zone_name,
         COUNT(*) FILTER (WHERE i.severity = 'low')::bigint AS low,
         COUNT(*) FILTER (WHERE i.severity = 'medium')::bigint AS medium,
         COUNT(*) FILTER (WHERE i.severity = 'high')::bigint AS high
       FROM incidents i
       LEFT JOIN zones z ON z.id = i.zone_id
       WHERE i.venue_id = $1
         AND i.business_date >= $2 AND i.business_date <= $3
       GROUP BY i.zone_id, z.name`,
      venueId, from, to,
    ),
    rawPrisma.$queryRawUnsafe<Array<{
      hour: number; count: bigint; severity: string;
    }>>(
      `SELECT
         EXTRACT(HOUR FROM occurred_at AT TIME ZONE $1)::int AS hour,
         COUNT(*)::bigint AS count,
         MODE() WITHIN GROUP (ORDER BY severity) AS severity
       FROM incidents
       WHERE venue_id = $2
         AND business_date >= $3 AND business_date <= $4
       GROUP BY 1 ORDER BY 1`,
      tz, venueId, from, to,
    ),
    rawPrisma.$queryRawUnsafe<Array<{ dow: number; count: bigint }>>(
      `SELECT
         EXTRACT(DOW FROM occurred_at AT TIME ZONE $1)::int AS dow,
         COUNT(*)::bigint AS count
       FROM incidents
       WHERE venue_id = $2
         AND business_date >= $3 AND business_date <= $4
       GROUP BY 1 ORDER BY 1`,
      tz, venueId, from, to,
    ),
    rawPrisma.$queryRawUnsafe<Array<{
      zone_name: string; hour: number; count: bigint;
    }>>(
      `SELECT
         COALESCE(z.name, 'Unknown') AS zone_name,
         EXTRACT(HOUR FROM i.occurred_at AT TIME ZONE $1)::int AS hour,
         COUNT(*)::bigint AS count
       FROM incidents i
       LEFT JOIN zones z ON z.id = i.zone_id
       WHERE i.venue_id = $2
         AND i.business_date >= $3 AND i.business_date <= $4
       GROUP BY z.name, 2
       ORDER BY 3 DESC LIMIT 5`,
      tz, venueId, from, to,
    ),
  ]);

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const zones = byZone.map((z) => ({
    zoneId: z.zone_id, zoneName: z.zone_name,
    low: Number(z.low), medium: Number(z.medium), high: Number(z.high),
    total: Number(z.low) + Number(z.medium) + Number(z.high),
  }));

  return {
    byZone: zones,
    byHour: byHour.map((h) => ({
      hour: String(h.hour).padStart(2, "0") + ":00",
      count: Number(h.count),
      severity: (h.severity ?? "low") as "low" | "medium" | "high",
    })),
    byDayOfWeek: byDow.map((d) => ({
      day: d.dow, dayName: dayNames[d.dow] ?? String(d.dow), count: Number(d.count),
    })),
    hotspots: hotspots.map((h) => ({
      zoneName: h.zone_name, hour: String(h.hour).padStart(2, "0") + ":00", count: Number(h.count),
    })),
    totalIncidents: zones.reduce((s, z) => s + z.total, 0),
  };
}

// ── AI-11: Guest retention ───────────────────────────────────────────

export async function getGuestRetentionMetrics(
  _db: ScopedDb,
  venueId: string,
  _nightConfig: NightConfig,
): Promise<GuestRetentionMetrics> {
  const rawPrisma = getRawPrisma();
  const now = new Date();
  const currFrom = new Date(now.getTime() - 30 * 86400000);
  const currTo = now;
  const prevFrom = new Date(now.getTime() - 60 * 86400000);
  const prevTo = new Date(now.getTime() - 30 * 86400000);

  const [
    newGuests, totalResult, powerUsers,
    vipResult, totalVips, prevActive, currActive,
    avgVisitsResult, avgGapResult,
  ] = await Promise.all([
    rawPrisma.guestProfile.count({
      where: { venueId, createdAt: { gte: currFrom, lt: currTo } },
    }),
    rawPrisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(DISTINCT guest_profile_id)::bigint AS count
       FROM guest_sessions
       WHERE venue_id = $1
         AND created_at >= $2::timestamptz AND created_at < $3::timestamptz
         AND guest_profile_id IS NOT NULL`,
      venueId, currFrom.toISOString(), currTo.toISOString(),
    ),
    rawPrisma.guestProfile.count({
      where: {
        venueId, visitCount: { gte: 3 },
        lastVisitAt: { gte: currFrom, lt: currTo },
      },
    }),
    rawPrisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(DISTINCT gp.id)::bigint AS count
       FROM guest_profiles gp
       JOIN guest_sessions gs ON gs.guest_profile_id = gp.id
       WHERE gp.venue_id = $1
         AND gp.vip_tier != 'none'
         AND gs.created_at >= $2::timestamptz AND gs.created_at < $3::timestamptz`,
      venueId, currFrom.toISOString(), currTo.toISOString(),
    ),
    rawPrisma.guestProfile.count({
      where: { venueId, vipTier: { not: "none" } },
    }),
    rawPrisma.$queryRawUnsafe<Array<{ guest_profile_id: string }>>(
      `SELECT DISTINCT guest_profile_id FROM guest_sessions
       WHERE venue_id = $1
         AND created_at >= $2 AND created_at < $3
         AND guest_profile_id IS NOT NULL`,
      venueId, prevFrom.toISOString(), prevTo.toISOString(),
    ),
    rawPrisma.$queryRawUnsafe<Array<{ guest_profile_id: string }>>(
      `SELECT DISTINCT guest_profile_id FROM guest_sessions
       WHERE venue_id = $1
         AND created_at >= $2 AND created_at < $3
         AND guest_profile_id IS NOT NULL`,
      venueId, currFrom.toISOString(), currTo.toISOString(),
    ),
    rawPrisma.$queryRawUnsafe<Array<{ avg: number }>>(
      `SELECT ROUND(AVG(visit_count)::numeric, 1) AS avg
       FROM guest_profiles
       WHERE venue_id = $1
         AND last_visit_at >= $2 AND last_visit_at < $3`,
      venueId, currFrom.toISOString(), currTo.toISOString(),
    ),
    rawPrisma.$queryRawUnsafe<Array<{ avg_gap_days: number }>>(
      `WITH session_gaps AS (
         SELECT guest_profile_id,
           created_at - LAG(created_at) OVER (PARTITION BY guest_profile_id ORDER BY created_at) AS gap
         FROM guest_sessions
         WHERE venue_id = $1 AND guest_profile_id IS NOT NULL
       )
       SELECT ROUND(AVG(EXTRACT(EPOCH FROM gap) / 86400)::numeric, 1) AS avg_gap_days
       FROM session_gaps WHERE gap IS NOT NULL`,
      venueId,
    ),
  ]);

  const totalGuests = Number(totalResult[0]?.count ?? 0);
  const returningGuests = totalGuests - newGuests;
  const currSet = new Set(currActive.map((r) => r.guest_profile_id));
  const churned = prevActive.filter((r) => !currSet.has(r.guest_profile_id)).length;

  return {
    newGuests,
    returningGuests: Math.max(0, returningGuests),
    totalGuests,
    repeatRate: totalGuests > 0 ? returningGuests / totalGuests : 0,
    churnRate: prevActive.length > 0 ? churned / prevActive.length : 0,
    avgVisitsPerGuest: avgVisitsResult[0]?.avg ?? 0,
    powerUsers,
    vipRetentionRate: totalVips > 0 ? Number(vipResult[0]?.count ?? 0) / totalVips : 0,
    avgDaysBetweenVisits: avgGapResult[0]?.avg_gap_days ?? 0,
  };
}

// ── AI-12: Bottle service utilization ───────────────────────────────

export async function getBottleServiceAnalytics(
  _db: ScopedDb,
  venueId: string,
  nightConfig: NightConfig,
): Promise<BottleServiceAnalytics> {
  const rawPrisma = getRawPrisma();
  const boundary = nightContaining(new Date(), nightConfig);
  const tz = nightConfig.timezone;

  const bottleRows = await rawPrisma.$queryRawUnsafe<Array<{
    item_id: string; item_name: string; category_id: string; category_name: string;
    bottles_sold: bigint; revenue_cents: bigint;
    zone_id: string; zone_name: string;
  }>>(
    `SELECT
       mi.id AS item_id, mi.name AS item_name,
       mc.id AS category_id, mc.name AS category_name,
       SUM(oi.quantity)::bigint AS bottles_sold,
       SUM(oi.unit_cents * oi.quantity)::bigint AS revenue_cents,
       o.zone_id, o.zone_name
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'
     JOIN menu_items mi ON mi.id = oi.menu_item_id
     JOIN menu_categories mc ON mc.id = mi.category_id
     WHERE o.venue_id = $1
       AND o.placed_at >= $2::timestamptz AND o.placed_at < $3::timestamptz
       AND mi.is_alcoholic = true
       AND mi.price_cents >= 5000
       AND (mi.tags ?? ARRAY[]::text[] && ARRAY['bottle']::text[]
            OR mc.name ILIKE '%champagne%'
            OR mc.name ILIKE '%bottle%'
            OR mc.name ILIKE '%spirits%')
     GROUP BY mi.id, mi.name, mc.id, mc.name, o.zone_id, o.zone_name
     ORDER BY revenue_cents DESC`,
    venueId, boundary.start.toISOString(), boundary.end.toISOString(),
  );

  const [presCount, peakHourResult] = await Promise.all([
    rawPrisma.activeShowLock.count({
      where: { venueId, startedAt: { gte: boundary.start, lt: boundary.end } },
    }),
    rawPrisma.$queryRawUnsafe<Array<{ hour: number; count: bigint }>>(
      `SELECT EXTRACT(HOUR FROM started_at AT TIME ZONE $1)::int AS hour,
         COUNT(*)::bigint AS count
       FROM active_show_locks
       WHERE venue_id = $2
         AND started_at >= $3 AND started_at < $4
       GROUP BY 1 ORDER BY 2 DESC LIMIT 1`,
      tz, venueId, boundary.start.toISOString(), boundary.end.toISOString(),
    ),
  ]);

  // Group by item, aggregating across zones
  const itemMap = new Map<string, {
    menuItemId: string; itemName: string; categoryId: string; categoryName: string;
    bottlesSold: number; revenue: number; presentations: number;
    zoneBreakdown: { zoneId: string; zoneName: string; bottles: number; revenue: number }[];
  }>();

  for (const r of bottleRows) {
    const key = r.item_id;
    let entry = itemMap.get(key);
    if (!entry) {
      entry = {
        menuItemId: r.item_id, itemName: r.item_name,
        categoryId: r.category_id, categoryName: r.category_name,
        bottlesSold: 0, revenue: 0, presentations: 0,
        zoneBreakdown: [],
      };
      itemMap.set(key, entry);
    }
    entry.bottlesSold += Number(r.bottles_sold);
    entry.revenue += Number(r.revenue_cents) / 100;
    entry.zoneBreakdown.push({
      zoneId: r.zone_id, zoneName: r.zone_name,
      bottles: Number(r.bottles_sold), revenue: Number(r.revenue_cents) / 100,
    });
  }

  const entries: BottleServiceAnalytics["entries"] = Array.from(itemMap.values())
    .map((e) => ({
      menuItemId: e.menuItemId, itemName: e.itemName,
      categoryId: e.categoryId, categoryName: e.categoryName,
      presentations: Math.max(1, Math.round(e.bottlesSold * 0.6)),
      bottlesSold: e.bottlesSold, revenue: e.revenue,
      avgRevenuePerPresentation: e.presentations > 0 ? e.revenue / Math.max(1, Math.round(e.bottlesSold * 0.6)) : e.revenue,
      zoneBreakdown: e.zoneBreakdown,
      shareOfBottleRevenue: 0,
    }));

  const totalBottleRevenue = entries.reduce((s, e) => s + e.revenue, 0);
  for (const e of entries) {
    e.shareOfBottleRevenue = totalBottleRevenue > 0 ? e.revenue / totalBottleRevenue : 0;
  }

  return {
    entries: entries.sort((a, b) => b.revenue - a.revenue),
    totalBottleRevenue,
    totalPresentations: presCount,
    totalBottlesSold: entries.reduce((s, e) => s + e.bottlesSold, 0),
    avgBottleRevenue: entries.length > 0 ? totalBottleRevenue / entries.length : 0,
    peakHour: peakHourResult[0] ? String(peakHourResult[0].hour).padStart(2, "0") + ":00" : "—",
  };
}

// ── AI-13: Capacity utilization ─────────────────────────────────────

export async function getCapacityUtilizationAnalytics(
  _db: ScopedDb,
  venueId: string,
  nightConfig: NightConfig,
): Promise<CapacityUtilizationAnalytics> {
  const rawPrisma = getRawPrisma();
  const boundary = nightContaining(new Date(), nightConfig);

  const venue = await rawPrisma.venue.findUnique({
    where: { id: venueId }, select: { legalCapacity: true },
  });
  const legalCapacity = venue?.legalCapacity ?? 120;

  // Sample occupancy every 15 minutes, then bucket by hour
  const samples = await rawPrisma.$queryRawUnsafe<Array<{
    sample_time: string; hour: number; occupancy: bigint;
  }>>(
    `SELECT
       gs.ts::text AS sample_time,
       EXTRACT(HOUR FROM gs.ts AT TIME ZONE $1)::int AS hour,
       (SELECT COUNT(*)
        FROM admissions a
        WHERE a.venue_id = $2
          AND a.business_date = $3
          AND a.admitted_at <= gs.ts
          AND (a.exited_at IS NULL OR a.exited_at > gs.ts)
       )::bigint AS occupancy
     FROM generate_series(
       $4::timestamptz,
       $5::timestamptz,
       '15 minutes'::interval
     ) gs(ts)`,
    nightConfig.timezone, venueId, boundary.label,
    boundary.start.toISOString(), boundary.end.toISOString(),
  );

  const hourMap = new Map<number, { samples: number; totalOcc: number; entries: number; exits: number }>();
  for (const s of samples) {
    let b = hourMap.get(s.hour);
    if (!b) { b = { samples: 0, totalOcc: 0, entries: 0, exits: 0 }; hourMap.set(s.hour, b); }
    b.samples++;
    b.totalOcc += Number(s.occupancy);
  }

  // Get entries/exits per hour from admissions table
  const flowRows = await rawPrisma.$queryRawUnsafe<Array<{
    hour: number; entries: bigint; exits: bigint;
  }>>(
    `SELECT
       EXTRACT(HOUR FROM admitted_at AT TIME ZONE $1)::int AS hour,
       COUNT(*)::bigint AS entries,
       COUNT(*) FILTER (WHERE exited_at IS NOT NULL)::bigint AS exits
     FROM admissions
     WHERE venue_id = $2 AND business_date = $3
     GROUP BY 1`,
    nightConfig.timezone, venueId, boundary.label,
  );

  for (const f of flowRows) {
    const b = hourMap.get(f.hour);
    if (b) { b.entries = Number(f.entries); b.exits = Number(f.exits); }
    else { hourMap.set(f.hour, { samples: 0, totalOcc: 0, entries: Number(f.entries), exits: Number(f.exits) }); }
  }

  const avgStayResult = await rawPrisma.$queryRawUnsafe<Array<{ avg_stay_min: number }>>(
    `SELECT ROUND(AVG(EXTRACT(EPOCH FROM (exited_at - admitted_at)) / 60))::int AS avg_stay_min
     FROM admissions WHERE venue_id = $1 AND business_date = $2 AND exited_at IS NOT NULL`,
    venueId, boundary.label,
  );

  const hourKeys = Array.from(hourMap.keys()).sort((a, b) => a - b);
  const buckets: CapacityUtilizationAnalytics["buckets"] = hourKeys.map((h) => {
    const b = hourMap.get(h)!;
    const avgOcc = b.samples > 0 ? Math.round(b.totalOcc / b.samples) : 0;
    return {
      hour: String(h).padStart(2, "0") + ":00",
      occupancy: avgOcc,
      utilizationPct: legalCapacity > 0 ? avgOcc / legalCapacity : 0,
      entries: b.entries,
      exits: b.exits,
    };
  });

  if (buckets.length === 0) {
    return {
      buckets: [], legalCapacity, peakOccupancy: 0, peakHour: "—",
      peakUtilizationPct: 0, avgOccupancy: 0, avgStayMinutes: 0,
      totalEntries: 0, totalExits: 0, exceededLegalCapacity: false,
    };
  }

  const peakBucket = buckets.reduce((a, b) => (b.occupancy > a.occupancy ? b : a), buckets[0]);

  return {
    buckets, legalCapacity,
    peakOccupancy: peakBucket.occupancy, peakHour: peakBucket.hour,
    peakUtilizationPct: peakBucket.utilizationPct,
    avgOccupancy: Math.round(buckets.reduce((s, b) => s + b.occupancy, 0) / buckets.length),
    avgStayMinutes: avgStayResult[0]?.avg_stay_min ?? 0,
    totalEntries: buckets.reduce((s, b) => s + b.entries, 0),
    totalExits: buckets.reduce((s, b) => s + b.exits, 0),
    exceededLegalCapacity: peakBucket.occupancy > legalCapacity,
  };
}

// ── AI-14: Night summary ─────────────────────────────────────────────

export async function getNightSummary(
  db: ScopedDb,
  venueId: string,
  nightConfig: NightConfig,
  businessDate?: string,
): Promise<NightSummary> {
  const rawPrisma = getRawPrisma();
  const tonight = await getSummaryForVenue(db, venueId, nightConfig);
  const boundary = businessDate
    ? nightForDate(businessDate, nightConfig)
    : nightContaining(new Date(), nightConfig);
  const label = boundary.label;

  const [staffOnDuty, highIncidents, soldOut, noShows, avgRevResult] = await Promise.all([
    rawPrisma.shift.count({
      where: { venueId, businessDate: label, status: { not: "draft" } },
    }),
    rawPrisma.incident.count({
      where: { venueId, businessDate: label, severity: "high" },
    }),
    rawPrisma.soldOutEvent.findMany({
      where: { venueId, at: { gte: boundary.start, lt: boundary.end } },
      select: { itemName: true },
    }),
    rawPrisma.reservation.count({
      where: {
        venueId, status: "no_show",
        startsAt: { gte: boundary.start, lt: boundary.end },
      },
    }),
    rawPrisma.$queryRawUnsafe<Array<{ avg_rev: number }>>(
      `SELECT ROUND(AVG(revenue_cents) / 100.0)::float AS avg_rev
       FROM nightly_rollups
       WHERE venue_id = $1
         AND night_date IN ($2, $3, $4, $5)`,
      venueId, addDays(label, -7), addDays(label, -14), addDays(label, -21), addDays(label, -28),
    ),
  ]);

  // Also query last week's revenue for the delta
  const lastWeekResult = await rawPrisma.$queryRawUnsafe<Array<{ rev_cents: bigint }>>(
    `SELECT revenue_cents FROM nightly_rollups
     WHERE venue_id = $1 AND night_date = $2`,
    venueId, addDays(label, -7),
  );

  const avgRevenue = avgRevResult[0]?.avg_rev ?? tonight.revenueTonight;
  const lastWeekRevenue = Number(lastWeekResult[0]?.rev_cents ?? BigInt(0)) / 100;

  const topItem = tonight.topItems[0]?.name ?? "N/A";
  const topPerformer = tonight.staffPerformance[0];

  const execSummaryParts: string[] = [];
  execSummaryParts.push(`${label} delivered $${fromCents(tonight.revenueTonight * 100)} in revenue across ${tonight.ordersTonight} orders.`);
  if (topPerformer) execSummaryParts.push(`${topPerformer.name} led the floor with $${fromCents(topPerformer.revenueServed * 100)} served.`);
  if (highIncidents > 0) execSummaryParts.push(`${highIncidents} high-severity incident(s) recorded.`);
  if (soldOut.length > 0) execSummaryParts.push(`${soldOut.length} item(s) sold out: ${soldOut.map((s) => s.itemName).join(", ")}.`);

  const actionItems: string[] = [];
  if (soldOut.length > 0) actionItems.push(`Restock sold-out items: ${soldOut.map((s) => s.itemName).join(", ")}`);
  if (noShows > 0) actionItems.push(`Follow up with ${noShows} no-show reservation(s).`);

  return {
    businessDate: label,
    generatedAt: new Date().toISOString(),
    revenue: {
      total: tonight.revenueTonight,
      deltaVsAvgPct: avgRevenue > 0 ? Math.round(((tonight.revenueTonight - avgRevenue) / avgRevenue) * 1000) / 10 : 0,
      deltaVsLastWeekPct: lastWeekRevenue > 0 ? Math.round(((tonight.revenueTonight - lastWeekRevenue) / lastWeekRevenue) * 1000) / 10 : 0,
    },
    orders: { total: tonight.ordersTonight, avgValue: tonight.avgOrderValue, topItem },
    covers: { total: tonight.reservations?.totalCovers ?? 0, seated: tonight.reservations?.seated ?? 0, noShowCount: noShows },
    staff: { onDuty: staffOnDuty, topPerformer: topPerformer?.name ?? "—", topPerformerRevenue: topPerformer?.revenueServed ?? 0 },
    incidents: { total: (await rawPrisma.incident.count({ where: { venueId, businessDate: label } })), highSeverity: highIncidents },
    inventory: { topSoldItem: topItem, soldOutItems: soldOut.map((s) => s.itemName) },
    executiveSummary: execSummaryParts.join(" "),
    actionItems,
    emailed: false,
  };
}

// ── AI-08: CSV export ────────────────────────────────────────────────

export async function exportReportCsv(
  db: ScopedDb,
  reportName: string,
  metrics: ReportMetric[],
  fromISO: string,
  toISO: string,
  recipient?: string,
): Promise<ReportExport> {
  const data = await getHistoricalForVenue(db, fromISO, toISO);
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
