import { describe, it, expect } from "vitest";
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

describe("Phase 4 analytics mock data — shape validation", () => {
  it("AI-01: night comparison has valid deltas", () => {
    const d = mockNightComparison;
    expect(d.referenceLabel).toBeTruthy();
    expect(d.current.revenue).toBeGreaterThan(0);
    expect(d.current.orders).toBeGreaterThan(0);
    expect(d.current.covers).toBeGreaterThan(0);
    expect(d.reference.revenue).toBeGreaterThan(0);
    expect(d.deltas.revenuePct).not.toBeNaN();
    expect(d.deltas.ordersPct).not.toBeNaN();
  });

  it("AI-02: night forecast projects forward", () => {
    const f = mockNightForecast;
    expect(f.current.revenue).toBeGreaterThan(0);
    expect(f.projected.revenue).toBeGreaterThan(f.current.revenue);
    expect(f.hoursElapsed).toBeLessThanOrEqual(f.hoursTotal);
    expect(f.paceMultiplier).toBeGreaterThan(1);
  });

  it("AI-03: per-hour buckets sum covers peak hour", () => {
    const h = mockPerHourAnalytics;
    expect(h.buckets.length).toBeGreaterThan(0);
    const peak = h.buckets.find((b) => b.hour === h.peakHour);
    expect(peak).toBeDefined();
    expect(peak!.peakFlag).toBe(true);
    expect(h.peakOccupancy).toBeLessThanOrEqual(h.legalCapacity);
  });

  it("AI-04: door funnel rates are probabilities", () => {
    const f = mockDoorToTableFunnel;
    const { rates } = f;
    expect(rates.sessionRate).toBeGreaterThan(0);
    expect(rates.sessionRate).toBeLessThanOrEqual(1);
    expect(rates.deliveryRate).toBeGreaterThan(0);
    expect(rates.deliveryRate).toBeLessThanOrEqual(1);
    expect(f.biggestDropPct).toBeGreaterThan(0);
  });

  it("AI-05: table turns have valid occupancy data", () => {
    const t = mockTableTurnAnalytics;
    expect(t.turns.length).toBeGreaterThan(0);
    expect(t.avgTurnsPerTable).toBeGreaterThan(0);
    expect(t.avgOccupancyMinutes).toBeGreaterThan(0);
    for (const turn of t.turns) {
      expect(turn.avgOccupancyMinutes).toBeGreaterThan(0);
      expect(turn.occupancyRate).toBeGreaterThan(0);
      expect(turn.occupancyRate).toBeLessThanOrEqual(1);
    }
    expect(t.fastestTurn.minutes).toBeLessThanOrEqual(t.slowestTurn.minutes);
  });

  it("AI-06: order SLA has valid percentiles", () => {
    const s = mockOrderSlaAnalytics;
    expect(s.p50Minutes).toBeGreaterThan(0);
    expect(s.p50Minutes).toBeLessThanOrEqual(s.p95Minutes);
    expect(s.p95Minutes).toBeLessThanOrEqual(s.p99Minutes);
    expect(s.distribution.length).toBeGreaterThan(0);
    const total = s.distribution.reduce((sum, d) => sum + d.count, 0);
    expect(total).toBeGreaterThan(0);
    expect(s.slaBreachRate).toBeGreaterThanOrEqual(0);
    expect(s.slaBreachRate).toBeLessThanOrEqual(1);
  });

  it("AI-07: comp/void ratio analytics flags exceed thresholds", () => {
    const c = mockCompVoidRatioAnalytics;
    expect(c.compRateThreshold).toBeGreaterThan(0);
    expect(c.voidRateThreshold).toBeGreaterThan(0);
    const flagged = c.entries.filter((e) => e.flagged);
    expect(flagged.length).toBe(c.flaggedCount);
    for (const e of c.entries) {
      expect(e.compRate).toBeGreaterThanOrEqual(0);
      expect(e.voidRate).toBeGreaterThanOrEqual(0);
    }
    expect(c.entries.find((e) => e.flagged)).toBeDefined();
  });

  it("AI-09: promoter performance has show-up and fill rates", () => {
    const p = mockPromoterPerformanceReport;
    expect(p.length).toBeGreaterThan(0);
    for (const promoter of p) {
      expect(promoter.showUpRate).toBeGreaterThan(0);
      expect(promoter.showUpRate).toBeLessThanOrEqual(1);
      expect(promoter.fillRate).toBeGreaterThan(0);
      expect(promoter.fillRate).toBeLessThanOrEqual(1);
      expect(promoter.checkIns).toBeLessThanOrEqual(promoter.reservationsConfirmed);
      expect(promoter.reservationsConfirmed).toBeLessThanOrEqual(promoter.reservationsCreated);
    }
  });

  it("AI-10: incident pattern has hotspots and severity breakdown", () => {
    const r = mockIncidentPatternReport;
    expect(r.totalIncidents).toBeGreaterThan(0);
    expect(r.byZone.length).toBeGreaterThan(0);
    expect(r.byHour.length).toBeGreaterThan(0);
    expect(r.byDayOfWeek.length).toBeGreaterThan(0);
    expect(r.hotspots.length).toBeGreaterThan(0);
    for (const z of r.byZone) {
      expect(z.low + z.medium + z.high).toBe(z.total);
    }
  });

  it("AI-11: guest retention rates are valid", () => {
    const g = mockGuestRetentionMetrics;
    expect(g.totalGuests).toBe(g.newGuests + g.returningGuests);
    expect(g.repeatRate).toBeGreaterThan(0);
    expect(g.repeatRate).toBeLessThanOrEqual(1);
    expect(g.churnRate).toBeGreaterThanOrEqual(0);
    expect(g.churnRate).toBeLessThanOrEqual(1);
    expect(g.vipRetentionRate).toBeGreaterThanOrEqual(0);
    expect(g.vipRetentionRate).toBeLessThanOrEqual(1);
    expect(g.powerUsers).toBeGreaterThan(0);
  });

  it("AI-12: bottle service has items and zone breakdowns", () => {
    const b = mockBottleServiceAnalytics;
    expect(b.entries.length).toBeGreaterThan(0);
    expect(b.totalBottleRevenue).toBeGreaterThan(0);
    expect(b.totalBottlesSold).toBeGreaterThan(0);
    const totalRev = b.entries.reduce((s, e) => s + e.revenue, 0);
    expect(b.totalBottleRevenue).toBeCloseTo(totalRev, 0);
    for (const e of b.entries) {
      expect(e.presentations).toBeGreaterThan(0);
      expect(e.bottlesSold).toBeGreaterThan(0);
      expect(e.zoneBreakdown.length).toBeGreaterThan(0);
    }
  });

  it("AI-13: capacity utilization never exceeds legal (if flag is false)", () => {
    const c = mockCapacityUtilizationAnalytics;
    expect(c.peakOccupancy).toBeLessThanOrEqual(c.legalCapacity);
    expect(c.peakUtilizationPct).toBeLessThanOrEqual(1);
    expect(c.exceededLegalCapacity).toBe(false);
    expect(c.totalEntries).toBeGreaterThanOrEqual(c.totalExits);
  });

  it("AI-14: night summary has action items and executive summary", () => {
    const s = mockNightSummary;
    expect(s.executiveSummary.length).toBeGreaterThan(0);
    expect(s.actionItems.length).toBeGreaterThan(0);
    expect(s.revenue.total).toBeGreaterThan(0);
    expect(s.orders.total).toBeGreaterThan(0);
    expect(s.covers.total).toBeGreaterThan(0);
    expect(s.staff.topPerformer).toBeTruthy();
  });
});
