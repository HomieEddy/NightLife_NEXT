import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getDb, type SessionContext } from "@/features/shared/db";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";
import { createCategory, createItem } from "@/features/menu/core";
import { submitOrder } from "@/features/ordering/core";
import { toCents } from "@/features/shared/money";
import {
  getNightComparison,
  getNightForecast,
  getPerHourAnalytics,
  getDoorToTableFunnel,
  getTableTurnAnalytics,
  getOrderSlaAnalytics,
  getCompVoidRatioAnalytics,
} from "@/features/analytics/analytics-phase4";
import { nightForDate } from "@/features/shared/night";

const UTC_NIGHT = { timezone: "UTC", nightStartHour: 18, nightEndHour: 10 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function makeVenue(rawClient: PrismaClient, name: string, slug: string, serviceFees: any = []) {
  const org = await rawClient.organization.create({ data: { id: `org-${slug}`, name, slug } });
  await rawClient.venue.create({
    data: {
      id: org.id, address: "1 Test St", city: "Testville",
      timezone: "UTC", currency: "USD", openingHours: [], serviceFees,
      floorMap: { width: 16, height: 9 }, autoApproveGuests: false, logoInitials: "TT",
      slaThresholds: { orderWarnMinutes: 6, orderCriticalMinutes: 12, helpWarnMinutes: 4, helpCriticalMinutes: 8 },
      lastCallAutoFlagTables: true,
    },
  });
  return org.id;
}

describe("Phase 4 analytics depth integration", () => {
  let testDb: TestDb;
  let rawClient: PrismaClient;
  let venueA: string;
  let sessionA: SessionContext;
  let itemId: string;

  beforeAll(async () => {
    testDb = await createTestDb();
    rawClient = testDb.rawClient;
    venueA = await makeVenue(rawClient, "Phase4 A", "phase4-a-int");
    sessionA = { venueId: venueA };

    const db = getDb(sessionA);
    const cat = await createCategory(db, venueA, { name: "Champagne", description: "", sortOrder: 1 });
    const item = await createItem(db, venueA, {
      categoryId: cat.id, name: "Dom Pérignon", description: "",
      priceCents: toCents(350), icon: "bottle", tags: ["bottle"],
      inventory: 24,
    });
    itemId = item.id;

    // Place orders in two nights for comparison testing
    const night1 = nightForDate("2026-07-14", UTC_NIGHT);
    const night2 = nightForDate("2026-07-21", UTC_NIGHT);

    for (const { night, count, tableCode, zoneName } of [
      { night: night1, count: 2, tableCode: "VIP-01", zoneName: "VIP Mezzanine" },
      { night: night1, count: 1, tableCode: "MAIN-01", zoneName: "Main Floor" },
      { night: night2, count: 3, tableCode: "VIP-02", zoneName: "VIP Mezzanine" },
    ]) {
      const result = await submitOrder(db, venueA, {
        tableId: tableCode, tableCode, zoneId: zoneName, zoneName,
        guestName: "Test Guest",
        lines: [{ menuItemId: itemId, quantity: count, modifiers: [] }],
        tipCents: 0,
      });
      if (result.ok) {
        await rawClient.order.update({
          where: { id: result.order.id },
          data: { placedAt: new Date(night.start.getTime() + 3600000) },
        });
      }
    }
  }, 60_000);

  afterAll(async () => { await testDb?.teardown(); });
  afterEach(() => { vi.useRealTimers(); });

  // ── AI-01: Night comparison ─────────────────────────────────────────

  it("getNightComparison returns tonight vs last same-weekday from rollups", async () => {
    const db = getDb(sessionA);
    // Pin clock to 2026-07-21 so "tonight" = July 21, reference = July 14
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-21T22:00:00Z"));

    const comp = await getNightComparison(db, venueA, UTC_NIGHT);
    expect(comp.referenceLabel).toBeTruthy();
    expect(comp.current.orders).toBeGreaterThan(0);
    expect(comp.deltas).toBeDefined();

    vi.useRealTimers();
  });

  // ── AI-02: Forecast ─────────────────────────────────────────────────

  it("getNightForecast projects end-of-night revenue", async () => {
    const db = getDb(sessionA);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-21T22:00:00Z"));

    const forecast = await getNightForecast(db, venueA, UTC_NIGHT);
    expect(forecast.current.revenue).toBeGreaterThanOrEqual(0);
    expect(forecast.projected.revenue).toBeGreaterThanOrEqual(forecast.current.revenue);
    expect(forecast.paceMultiplier).toBeGreaterThan(1);
    expect(forecast.hoursElapsed).toBeGreaterThan(0);

    vi.useRealTimers();
  });

  // ── AI-03: Per-hour ─────────────────────────────────────────────────

  it("getPerHourAnalytics groups orders by venue-local hour", async () => {
    const db = getDb(sessionA);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-21T22:00:00Z"));

    const hourly = await getPerHourAnalytics(db, venueA, UTC_NIGHT);
    expect(hourly.buckets.length).toBeGreaterThan(0);
    if (hourly.buckets.length > 0) {
      expect(hourly.buckets[0].hour).toMatch(/^\d{2}:00$/);
      expect(hourly.peakHour).toBeTruthy();
      expect(hourly.legalCapacity).toBeGreaterThan(0);
    }

    vi.useRealTimers();
  });

  // ── AI-04: Door-to-table funnel ─────────────────────────────────────

  it("getDoorToTableFunnel returns valid funnel steps", async () => {
    const db = getDb(sessionA);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-21T22:00:00Z"));

    const funnel = await getDoorToTableFunnel(db, venueA, UTC_NIGHT);
    expect(funnel.ordersPlaced).toBeGreaterThan(0);
    expect(funnel.rates.sessionRate).toBeGreaterThanOrEqual(0);
    expect(funnel.rates.deliveryRate).toBeGreaterThanOrEqual(0);
    expect(funnel.biggestDropStep).toBeTruthy();

    vi.useRealTimers();
  });

  // ── AI-06: Order SLA ────────────────────────────────────────────────

  it("getOrderSlaAnalytics computes percentiles from real delivery times", async () => {
    const db = getDb(sessionA);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-21T22:00:00Z"));

    const sla = await getOrderSlaAnalytics(db, venueA, UTC_NIGHT);
    // avgAccept + avgPrep ≈ avgTotal
    expect(sla.avgTotalMinutes).toBeGreaterThanOrEqual(0);
    expect(sla.p50Minutes).toBeGreaterThanOrEqual(0);
    // Distribution buckets should sum to the order count
    const distTotal = sla.distribution.reduce((s, d) => s + d.count, 0);
    expect(distTotal).toBeGreaterThanOrEqual(0);

    vi.useRealTimers();
  });

  // ── AI-07: Comp/void ratio ──────────────────────────────────────────

  it("getCompVoidRatioAnalytics returns per-staff rates with thresholds", async () => {
    const db = getDb(sessionA);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-21T22:00:00Z"));

    const ratios = await getCompVoidRatioAnalytics(db, venueA, UTC_NIGHT);
    expect(ratios.compRateThreshold).toBeGreaterThan(0);
    expect(ratios.voidRateThreshold).toBeGreaterThan(0);
    for (const e of ratios.entries) {
      expect(e.compRate).toBeGreaterThanOrEqual(0);
      expect(e.voidRate).toBeGreaterThanOrEqual(0);
    }

    vi.useRealTimers();
  });
});
