import { describe, it, expect } from "vitest";
import { mockAnalytics } from "@/lib/mock-data/analytics";

describe("mockAnalytics summary shape", () => {
  it("contains core KPI fields", () => {
    expect(mockAnalytics.revenueTonight).toBeGreaterThan(0);
    expect(mockAnalytics.ordersTonight).toBeGreaterThan(0);
    expect(mockAnalytics.avgOrderValue).toBeGreaterThan(0);
    expect(mockAnalytics.activeTables).toBeGreaterThanOrEqual(0);
    expect(mockAnalytics.totalTables).toBeGreaterThan(0);
    expect(mockAnalytics.topItems.length).toBeGreaterThan(0);
    expect(mockAnalytics.revenueByHour.length).toBeGreaterThan(0);
    expect(mockAnalytics.staffPerformance.length).toBeGreaterThan(0);
  });

  it("contains sessions analytics", () => {
    const s = mockAnalytics.sessions;
    expect(s).toBeDefined();
    expect(s!.totalSessions).toBeGreaterThan(0);
    expect(s!.approvalRate).toBeGreaterThan(0);
    expect(s!.approvalRate).toBeLessThanOrEqual(1);
    expect(s!.denialRate).toBeGreaterThanOrEqual(0);
    expect(s!.avgDurationMinutes).toBeGreaterThan(0);
    expect(s!.avgPartySize).toBeGreaterThan(0);
    expect(s!.revenuePerSession).toBeGreaterThan(0);
    expect(s!.revenuePerGuest).toBeGreaterThan(0);
    expect(s!.settlementMix.length).toBeGreaterThan(0);
    const totalPct = s!.settlementMix.reduce((sum, m) => sum + m.pct, 0);
    expect(totalPct).toBeCloseTo(1, 1);
  });

  it("contains order funnel analytics", () => {
    const f = mockAnalytics.orderFunnel;
    expect(f).toBeDefined();
    expect(f!.placed).toBeGreaterThan(0);
    expect(f!.delivered).toBeGreaterThan(0);
    expect(f!.delivered).toBeLessThanOrEqual(f!.placed);
    expect(f!.cancelled).toBeGreaterThanOrEqual(0);
    expect(f!.cancellationRate).toBeGreaterThanOrEqual(0);
    expect(f!.cancellationRate).toBeLessThanOrEqual(1);
    expect(f!.tipRate).toBeGreaterThanOrEqual(0);
    expect(f!.tipRate).toBeLessThanOrEqual(1);
    expect(f!.serviceFeeRevenue).toBeGreaterThanOrEqual(0);
  });

  it("contains reservations analytics", () => {
    const r = mockAnalytics.reservations;
    expect(r).toBeDefined();
    expect(r!.requested).toBeGreaterThan(0);
    expect(r!.confirmed).toBeLessThanOrEqual(r!.requested);
    expect(r!.seated).toBeLessThanOrEqual(r!.confirmed);
    expect(r!.totalCovers).toBeGreaterThan(0);
    expect(r!.noShowRate).toBeGreaterThanOrEqual(0);
    expect(r!.noShowRate).toBeLessThanOrEqual(1);
    expect(r!.sourceSplit.length).toBeGreaterThan(0);
    expect(r!.partySizeDistribution.length).toBeGreaterThan(0);
  });

  it("contains happy hours analytics", () => {
    const h = mockAnalytics.happyHours;
    expect(h).toBeDefined();
    expect(h!.rules.length).toBeGreaterThan(0);
    expect(h!.totalHhOrders).toBeGreaterThan(0);
    expect(h!.totalHhRevenue).toBeGreaterThan(0);
    expect(h!.totalDiscountGiven).toBeGreaterThan(0);
    for (const rule of h!.rules) {
      expect(rule.ruleId).toBeTruthy();
      expect(rule.ruleName).toBeTruthy();
      expect(rule.orders).toBeGreaterThan(0);
      expect(rule.revenue).toBeGreaterThan(0);
    }
  });

  it("contains events analytics", () => {
    const e = mockAnalytics.events;
    expect(e).toBeDefined();
    expect(e!.events.length).toBeGreaterThan(0);
    expect(e!.totalEvents).toBe(e!.events.length);
    expect(e!.avgCapacityUtilization).toBeGreaterThan(0);
    expect(e!.avgCapacityUtilization).toBeLessThanOrEqual(1);
    for (const evt of e!.events) {
      expect(evt.eventName).toBeTruthy();
      expect(evt.checkedIn).toBeLessThanOrEqual(evt.confirmed);
      expect(evt.confirmed).toBeLessThanOrEqual(evt.invited);
    }
  });

  it("contains promotions analytics", () => {
    const p = mockAnalytics.promotions;
    expect(p).toBeDefined();
    expect(p!.promotions.length).toBeGreaterThan(0);
    expect(p!.totalRedemptions).toBeGreaterThan(0);
    expect(p!.totalDiscountCost).toBeGreaterThan(0);
    for (const promo of p!.promotions) {
      expect(promo.code).toBeTruthy();
      expect(promo.redemptions).toBeGreaterThan(0);
      expect(promo.aovWithPromo).toBeGreaterThan(0);
    }
  });

  it("contains inventory depth analytics", () => {
    const inv = mockAnalytics.inventoryDepth;
    expect(inv).toBeDefined();
    expect(inv!.soldOutEventsPerNight).toBeGreaterThanOrEqual(0);
    expect(inv!.totalSoldOutMinutes).toBeGreaterThanOrEqual(0);
    expect(inv!.restockSaleRatio).toBeGreaterThanOrEqual(0);
    expect(inv!.deadItems).toBeGreaterThanOrEqual(0);
  });

  it("has deepened staff performance fields", () => {
    for (const staff of mockAnalytics.staffPerformance) {
      expect(staff.avgClaimMinutes).toBeDefined();
      expect(staff.avgClaimMinutes).toBeGreaterThanOrEqual(0);
      expect(staff.helpResolved).toBeDefined();
      expect(staff.helpResolved).toBeGreaterThanOrEqual(0);
      expect(staff.avgHelpMinutes).toBeDefined();
      expect(staff.ordersPerShiftHour).toBeDefined();
      expect(staff.ordersPerShiftHour).toBeGreaterThan(0);
    }
  });
});
