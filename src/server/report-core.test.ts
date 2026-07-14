import { describe, it, expect } from "vitest";
import { renderCsv } from "./report-core";
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
    { staffId: "s1", name: "Alex", role: "runner", ordersDelivered: 45, avgDeliveryMinutes: 4, revenueServed: 22000 },
  ],
  categoryDepletion: [
    { categoryId: "c1", categoryName: "Champagne", unitsSold: 50, unitsInStock: 30 },
  ],
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

  it("renders staff section with all columns", () => {
    const csv = renderCsv("Test", ["staff"], FIXTURE);
    expect(csv).toContain('"Staff","Role","Orders delivered","Avg minutes","Revenue served"');
    expect(csv).toContain('"Alex","runner","45","4","22000"');
  });

  it("renders inventory section", () => {
    const csv = renderCsv("Test", ["inventory"], FIXTURE);
    expect(csv).toContain('"Category","Units sold","In stock"');
    expect(csv).toContain('"Champagne","50","30"');
  });

  it("renders all sections when all metrics selected", () => {
    const csv = renderCsv("Full", ["revenue", "zones", "top-items", "staff", "inventory"], FIXTURE);
    expect(csv).toContain('"Night","Revenue","Orders"');
    expect(csv).toContain('"Zone","Revenue"');
    expect(csv).toContain('"Item","Sold","Revenue"');
    expect(csv).toContain('"Staff","Role"');
    expect(csv).toContain('"Category","Units sold"');
  });
});
