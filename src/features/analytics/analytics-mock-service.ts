/**
 * mockAnalyticsService — demo-mode analytics with seeded data.
 */
import type {
  AdjustmentAnalytics,
  AnalyticsSummary,
  RevenuePoint,
  HistoricalAnalytics,
  TabAdjustmentKind,
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
import { mockAnalytics } from "@/features/analytics/analytics-mock-data";
import {
  mockNightComparison,
  mockNightForecast,
  mockPerHourAnalytics,
  mockDoorToTableFunnel,
  mockTableTurnAnalytics,
  mockOrderSlaAnalytics,
  mockCompVoidRatioAnalytics,
  mockPromoterPerformanceReport,
  mockIncidentPatternReport,
  mockGuestRetentionMetrics,
  mockBottleServiceAnalytics,
  mockCapacityUtilizationAnalytics,
  mockNightSummary,
} from "@/features/analytics/analytics-depth-mock-data";
import { aggregateWeekly } from "@/lib/analytics";
import { renderCsv } from "@/features/analytics/report-csv";
import { mockOrdersService } from "@/features/ordering/mock-service";
import { clone, delay, uid } from "@/features/shared/delay";

export { aggregateWeekly };

// Deterministic pseudo-random per date, so ranges are stable across calls.
function seeded(dateKey: string): number {
  let hash = 0;
  for (const char of dateKey) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  hash = (hash * 1103515245 + 12345) >>> 0;
  return (hash % 1000) / 1000; // 0..1
}

/** Apply a seeded ±10% variance to numeric fields in depth mock objects.
 *  Makes different date ranges produce slightly different mock data.
 *  Preserves small integer counts; varies monetary/rate fields at 2dp. */
function varyDepth<T>(data: T, seedKey: string): T {
  const s = seeded(seedKey);
  const factor = 0.9 + s * 0.2; // 0.9 .. 1.1
  return JSON.parse(JSON.stringify(data), (_k, v) => {
    if (typeof v !== "number") return v;
    const varied = v * factor;
    return v === Math.round(v) && v <= 1000 ? Math.max(0, Math.round(varied)) : Math.round(varied * 100) / 100;
  }) as T;
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

/** Live (not seeded) comp/void/discount rollup — reflects tonight's actual ledger, unlike the rest of this generator. */
async function computeAdjustmentAnalytics(): Promise<AdjustmentAnalytics> {
  const [orders, adjustments] = await Promise.all([
    mockOrdersService.listOrders(),
    mockOrdersService.listAllAdjustments(),
  ]);
  const grossCents = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + Math.round(o.total * 100), 0);
  const live = adjustments.filter((a) => !a.reversedByAdjustmentId);
  const byKind = (kind: TabAdjustmentKind) => live.filter((a) => a.kind === kind);
  const centsOf = (kind: TabAdjustmentKind) => byKind(kind).reduce((sum, a) => sum + a.amountCents, 0);
  const voidCents = centsOf("void");
  const compCents = centsOf("comp");
  const discountCents = centsOf("discount");
  const byReason = new Map<string, { kind: TabAdjustmentKind; reasonCode: string; count: number; amountCents: number }>();
  for (const a of live) {
    const key = `${a.kind}:${a.reasonCode}`;
    const entry = byReason.get(key) ?? { kind: a.kind, reasonCode: a.reasonCode, count: 0, amountCents: 0 };
    entry.count += 1;
    entry.amountCents += a.amountCents;
    byReason.set(key, entry);
  }
  return {
    voidCount: byKind("void").length,
    compCount: byKind("comp").length,
    discountCount: byKind("discount").length,
    voidCents,
    compCents,
    discountCents,
    voidRate: grossCents > 0 ? voidCents / grossCents : 0,
    compRate: grossCents > 0 ? compCents / grossCents : 0,
    discountRate: grossCents > 0 ? discountCents / grossCents : 0,
    byReason: Array.from(byReason.values()),
  };
}

export const mockAnalyticsService = {
  /** Tonight's live snapshot — powers the manager dashboard. */
  async getSummary(): Promise<AnalyticsSummary> {
    await delay(600);
    return { ...clone(mockAnalytics), adjustments: await computeAdjustmentAnalytics() };
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
      pourCostPercent: 28.5,
      grossMarginPercent: 71.5,
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
      // Live, not scaled — the demo's ledger only ever holds "tonight"; a real backend
      // would query the range directly instead of projecting a single night forward.
      adjustments: await computeAdjustmentAnalytics(),
    };
  },

  // ---------- Phase 4: Analytics Depth (AI-01 through AI-14) ----------

  /** AI-01: Night-over-night comparison — tonight vs a reference night. */
  async getNightComparison(): Promise<NightComparison> {
    await delay(400);
    return clone(mockNightComparison);
  },

  /** AI-02: Night forecast / projection — current pace extrapolated. */
  async getNightForecast(): Promise<NightForecast> {
    await delay(350);
    return clone(mockNightForecast);
  },

  /** AI-03: Per-hour breakdown — revenue, orders, admissions by hour. */
  async getPerHourAnalytics(fromISO: string, _toISO: string): Promise<PerHourAnalytics> {
    await delay(500);
    return varyDepth(clone(mockPerHourAnalytics), fromISO);
  },

  /** AI-04: Door-to-table conversion funnel — admissions through to delivered orders. */
  async getDoorToTableFunnel(fromISO: string, _toISO: string): Promise<DoorToTableFunnel> {
    await delay(450);
    return varyDepth(clone(mockDoorToTableFunnel), fromISO);
  },

  /** AI-05: Table-turn analytics — avg occupancy, seatings per table per night. */
  async getTableTurnAnalytics(fromISO: string, _toISO: string): Promise<TableTurnAnalytics> {
    await delay(500);
    return varyDepth(clone(mockTableTurnAnalytics), fromISO);
  },

  /** AI-06: Order SLA / time-to-serve analytics — distribution, by zone, by staff. */
  async getOrderSlaAnalytics(fromISO: string, _toISO: string): Promise<OrderSlaAnalytics> {
    await delay(500);
    return varyDepth(clone(mockOrderSlaAnalytics), fromISO);
  },

  /** AI-07: Comp/void ratio monitoring — per-staff with threshold alerting. */
  async getCompVoidRatioAnalytics(fromISO: string, _toISO: string): Promise<CompVoidRatioAnalytics> {
    await delay(450);
    return varyDepth(clone(mockCompVoidRatioAnalytics), fromISO);
  },

  /** AI-08: Report CSV export — generate and optionally email a report. */
  async exportReportCsv(
    reportName: string,
    metrics: ReportMetric[],
    fromISO: string,
    toISO: string,
    recipient?: string,
  ): Promise<ReportExport> {
    await delay(800);
    const data = await this.getHistorical(fromISO, toISO);
    const csv = renderCsv(reportName, metrics, data);
    const emailed = !!recipient;
    return {
      id: uid("rpt"),
      reportName,
      metrics,
      rangeFrom: fromISO,
      rangeTo: toISO,
      format: "csv",
      status: emailed ? "emailed" : "generated",
      csvContent: csv,
      emailedAt: emailed ? new Date().toISOString() : undefined,
      recipient,
      createdAt: new Date().toISOString(),
    };
  },

  /** AI-09: Promoter performance report — fill rate, check-in rate, spend, commission. */
  async getPromoterPerformanceReport(fromISO: string, _toISO: string): Promise<PromoterPerformanceReport[]> {
    await delay(500);
    return varyDepth(clone(mockPromoterPerformanceReport), fromISO);
  },

  /** AI-10: Security incident pattern report — by zone, time, night, staff presence. */
  async getIncidentPatternReport(fromISO: string, _toISO: string): Promise<IncidentPatternReport> {
    await delay(450);
    return varyDepth(clone(mockIncidentPatternReport), fromISO);
  },

  /** AI-11: Guest retention report — repeat rate, churn, new vs returning. */
  async getGuestRetentionMetrics(fromISO: string, _toISO: string): Promise<GuestRetentionMetrics> {
    await delay(500);
    return varyDepth(clone(mockGuestRetentionMetrics), fromISO);
  },

  /** AI-12: Bottle service utilization — by brand, zone, time; presentation frequency. */
  async getBottleServiceAnalytics(fromISO: string, _toISO: string): Promise<BottleServiceAnalytics> {
    await delay(500);
    return varyDepth(clone(mockBottleServiceAnalytics), fromISO);
  },

  /** AI-13: Capacity utilization — peak occupancy, entry/exit rates, avg stay. */
  async getCapacityUtilizationAnalytics(fromISO: string, _toISO: string): Promise<CapacityUtilizationAnalytics> {
    await delay(450);
    return varyDepth(clone(mockCapacityUtilizationAnalytics), fromISO);
  },

  /** AI-14: Night summary auto-generation — one-page executive summary at venue close. */
  async getNightSummary(businessDate: string): Promise<NightSummary> {
    await delay(600);
    const summary = clone(mockNightSummary);
    summary.businessDate = businessDate;
    return summary;
  },
};

