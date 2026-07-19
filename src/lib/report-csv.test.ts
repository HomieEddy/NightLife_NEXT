import { describe, it, expect } from "vitest";
import { renderCsv } from "./report-csv";
import type { HistoricalAnalytics } from "@/lib/types";

const FIXTURE: HistoricalAnalytics = {
  from: "2026-07-07",
  to: "2026-07-14",
  days: 7,
  totalRevenue: 84000,
  totalOrders: 800,
  avgOrderValue: 105,
  bestNight: { label: "7/12", revenue: 18000, orders: 170 },
  series: [
    { label: "7/7", revenue: 12000, orders: 110 },
    { label: "7/8", revenue: 12000, orders: 120 },
  ],
  revenueByZone: [
    { zoneId: "z1", zoneName: "VIP", revenue: 50000 },
    { zoneId: "z2", zoneName: "Main", revenue: 34000 },
  ],
  topItems: [
    { name: "Dom Pérignon", count: 25, revenue: 12500 },
    { name: 'Moët "Rosé"', count: 18, revenue: 5400 },
  ],
  staffPerformance: [
    { staffId: "s1", name: "Alex", role: "runner", ordersDelivered: 45, avgDeliveryMinutes: 4, revenueServed: 22000, avgClaimMinutes: 1.5, helpResolved: 8, avgHelpMinutes: 2.3, ordersPerShiftHour: 6.4 },
  ],
  categoryDepletion: [
    { categoryId: "c1", categoryName: "Champagne", unitsSold: 50, unitsInStock: 30, sellThrough: 0.63, soldOutMinutes: 0, restockUnits: 20, deadItem: false },
  ],
  sessions: {
    totalSessions: 31,
    approvalRate: 0.87,
    denialRate: 0.13,
    avgApprovalMinutes: 2.4,
    avgDurationMinutes: 142,
    avgPartySize: 3.2,
    revenuePerSession: 400.65,
    revenuePerGuest: 125.2,
    settlementMix: [
      { method: "terminal", count: 19, pct: 0.61 },
      { method: "cash", count: 8, pct: 0.26 },
      { method: "house", count: 4, pct: 0.13 },
    ],
    avgClosureMinutes: 4.8,
  },
  reservations: {
    requested: 18,
    confirmed: 14,
    seated: 12,
    completed: 11,
    cancelled: 3,
    confirmRate: 0.78,
    seatedRate: 0.86,
    cancellationRate: 0.17,
    noShowRate: 0.07,
    avgLeadDays: 3.2,
    totalCovers: 44,
    sourceSplit: [
      { source: "manager", count: 11, pct: 0.61 },
      { source: "public", count: 7, pct: 0.39 },
    ],
    channelSplit: [
      { channel: "manager", count: 11, pct: 0.61 },
      { channel: "embed", count: 4, pct: 0.22 },
      { channel: "direct", count: 2, pct: 0.11 },
      { channel: "walk-in", count: 1, pct: 0.06 },
    ],
    partySizeDistribution: [
      { size: 2, count: 5 },
      { size: 4, count: 7 },
    ],
  },
  happyHours: {
    rules: [
      { ruleId: "hh-1", ruleName: "Early Bird", orders: 22, revenue: 1340, discountGiven: 268, categoryUpliftPct: 0.35 },
    ],
    totalDiscountGiven: 268,
    totalHhOrders: 22,
    totalHhRevenue: 1340,
  },
  events: {
    events: [
      { eventId: "evt-1", eventName: "Latin Night", invited: 80, confirmed: 62, checkedIn: 48, capacityUtilization: 0.8, guestlistConversion: 0.6, eventRevenue: 5200, avgWeekdayRevenue: 3800 },
    ],
    totalEvents: 1,
    avgCapacityUtilization: 0.8,
  },
  promotions: {
    promotions: [
      { promotionId: "promo-1", code: "WELCOME10", redemptions: 8, discountCost: 69.52, attributedRevenue: 695.2, aovWithPromo: 86.9, aovWithoutPromo: 92.4 },
    ],
    totalRedemptions: 8,
    totalDiscountCost: 69.52,
  },
  orderFunnel: {
    placed: 143,
    accepted: 138,
    preparing: 0,
    delivered: 132,
    cancelled: 5,
    cancellationRate: 0.035,
    tipRate: 0.62,
    avgTip: 8.4,
    serviceFeeRevenue: 428.4,
    giftOrders: 4,
    giftRevenue: 1120,
    modifierAttachRate: 0.28,
  },
  inventoryDepth: {
    soldOutEventsPerNight: 1,
    totalSoldOutMinutes: 45,
    restockSaleRatio: 0.52,
    deadItems: 0,
  },
};

describe("renderCsv", () => {
  it("renders revenue section with totals", () => {
    const csv = renderCsv("Test", ["revenue"], FIXTURE);
    const lines = csv.split("\n");
    expect(lines[0]).toBe('"Report","Test"');
    expect(lines[3]).toBe('"Night","Revenue","Orders"');
    expect(lines[4]).toBe('"7/7","12000","110"');
    expect(lines[6]).toBe('"Total","84000","800"');
  });

  it("escapes double quotes in cell values", () => {
    const csv = renderCsv("Test", ["top-items"], FIXTURE);
    expect(csv).toContain('"Moët ""Rosé"""');
  });

  it("includes only requested metric sections", () => {
    const csv = renderCsv("Test", ["zones"], FIXTURE);
    expect(csv).toContain('"Zone","Revenue"');
    expect(csv).not.toContain('"Night","Revenue","Orders"');
    expect(csv).not.toContain('"Staff"');
  });

  it("renders staff section with deepened columns", () => {
    const csv = renderCsv("Test", ["staff"], FIXTURE);
    expect(csv).toContain('"Staff","Role","Orders delivered","Avg minutes","Revenue served","Claim wait min","Help resolved","Avg help min","Orders/hr"');
    expect(csv).toContain('"Alex","runner","45","4","22000","1.5","8","2.3","6.4"');
  });

  it("renders inventory section with deepened columns", () => {
    const csv = renderCsv("Test", ["inventory"], FIXTURE);
    expect(csv).toContain('"Category","Units sold","In stock","Sell-through","Sold-out min","Restock units"');
    expect(csv).toContain('"Champagne","50","30","0.63","0","20"');
  });

  it("renders sessions section", () => {
    const csv = renderCsv("Test", ["sessions"], FIXTURE);
    expect(csv).toContain('"Sessions"');
    expect(csv).toContain('"Total sessions","31"');
    expect(csv).toContain('"Approval rate","0.87"');
    expect(csv).toContain('"Revenue / session","400.65"');
    expect(csv).toContain('"Tab settlement (staff-recorded)","Count","Pct"');
    expect(csv).toContain('"terminal","19","0.61"');
    expect(csv).toContain('"cash","8","0.26"');
  });

  it("renders reservations section", () => {
    const csv = renderCsv("Test", ["reservations"], FIXTURE);
    expect(csv).toContain('"Reservations"');
    expect(csv).toContain('"Requested","Confirmed","Seated","Completed","Cancelled","No-show rate","Avg lead days","Total covers"');
    expect(csv).toContain('"18","14","12","11","3","0.07","3.2","44"');
    expect(csv).toContain('"Source","Count","Pct"');
    expect(csv).toContain('"manager","11","0.61"');
  });

  it("renders happy-hours section", () => {
    const csv = renderCsv("Test", ["happy-hours"], FIXTURE);
    expect(csv).toContain('"Happy Hours"');
    expect(csv).toContain('"Total HH orders","22"');
    expect(csv).toContain('"Total HH revenue","1340"');
    expect(csv).toContain('"Rule","Orders","Revenue","Discount","Category uplift"');
    expect(csv).toContain('"Early Bird","22","1340","268","0.35"');
  });

  it("renders events section", () => {
    const csv = renderCsv("Test", ["events"], FIXTURE);
    expect(csv).toContain('"Events"');
    expect(csv).toContain('"Event","Invited","Confirmed","Checked in","Utilization","Event revenue","Avg weekday revenue"');
    expect(csv).toContain('"Latin Night","80","62","48","0.8","5200","3800"');
  });

  it("renders promotions section", () => {
    const csv = renderCsv("Test", ["promotions"], FIXTURE);
    expect(csv).toContain('"Promotions"');
    expect(csv).toContain('"Code","Redemptions","Discount cost","Attributed revenue","AOV with promo","AOV without promo"');
    expect(csv).toContain('"WELCOME10","8","69.52","695.2","86.9","92.4"');
  });

  it("renders order-funnel section", () => {
    const csv = renderCsv("Test", ["order-funnel"], FIXTURE);
    expect(csv).toContain('"Order Funnel"');
    expect(csv).toContain('"Placed","Accepted","Delivered","Cancelled","Cancellation rate","Tip rate","Avg tip","Service fee revenue","Gift orders","Gift revenue","Modifier attach rate"');
    expect(csv).toContain('"143","138","132","5","0.035","0.62","8.4","428.4","4","1120","0.28"');
  });

  it("renders service-fees section from orderFunnel data", () => {
    const csv = renderCsv("Test", ["service-fees"], FIXTURE);
    expect(csv).toContain('"Service Fees"');
    expect(csv).toContain('"Service fee revenue","428.4"');
  });

  it("renders all sections when all metrics selected", () => {
    const csv = renderCsv("Full", [
      "revenue", "zones", "top-items", "staff", "inventory",
      "sessions", "reservations", "happy-hours", "events", "promotions",
      "order-funnel", "service-fees",
    ], FIXTURE);
    expect(csv).toContain('"Night","Revenue","Orders"');
    expect(csv).toContain('"Zone","Revenue"');
    expect(csv).toContain('"Item","Sold","Revenue"');
    expect(csv).toContain('"Staff","Role"');
    expect(csv).toContain('"Category","Units sold"');
    expect(csv).toContain('"Sessions"');
    expect(csv).toContain('"Reservations"');
    expect(csv).toContain('"Happy Hours"');
    expect(csv).toContain('"Events"');
    expect(csv).toContain('"Promotions"');
    expect(csv).toContain('"Order Funnel"');
    expect(csv).toContain('"Service Fees"');
  });

  it("omits new sections when data is missing (v1 rollup compatibility)", () => {
    const v1Fixture: HistoricalAnalytics = {
      ...FIXTURE,
      sessions: undefined,
      reservations: undefined,
      happyHours: undefined,
      events: undefined,
      promotions: undefined,
      orderFunnel: undefined,
      inventoryDepth: undefined,
    };
    const csv = renderCsv("Test", [
      "sessions", "reservations", "happy-hours", "events", "promotions",
      "order-funnel", "service-fees",
    ], v1Fixture);
    expect(csv).not.toContain('"Sessions"');
    expect(csv).not.toContain('"Reservations"');
    expect(csv).not.toContain('"Happy Hours"');
    expect(csv).not.toContain('"Events"');
    expect(csv).not.toContain('"Promotions"');
    expect(csv).not.toContain('"Order Funnel"');
    expect(csv).not.toContain('"Service Fees"');
  });
});
