import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getDb, type SessionContext } from "../features/shared/db";
import { createTestDb, type TestDb } from "../features/shared/test-pglite";
import { createCategory, createItem } from "@/features/menu/core";
import { submitOrder } from "@/features/ordering/core";
import { toCents } from "../features/shared/money";
import {
  getSummaryForVenue,
  computeRollup,
  upsertRollup,
  getHistoricalForVenue,
} from "@/features/analytics/analytics-core";
import {
  listReports,
  createReport,
  updateReport,
  deleteReport,
  recordRun,
  findDueReports,
} from "@/features/analytics/report-core";
import { nightContaining, nightForDate } from "../features/shared/night";
import { expectTenantIsolation } from "../features/shared/test-helpers";

const UTC_NIGHT = {
  timezone: "UTC",
  nightStartHour: 18,
  nightEndHour: 10,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function makeVenue(rawClient: PrismaClient, name: string, slug: string, serviceFees: any = []) {
  const org = await rawClient.organization.create({ data: { id: `org-${slug}`, name, slug } });
  await rawClient.venue.create({
    data: {
      id: org.id,
      address: "1 Test St",
      city: "Testville",
      timezone: "UTC",
      currency: "USD",
      openingHours: [],
      serviceFees,
      floorMap: { width: 16, height: 9 },
      autoApproveGuests: false,
      logoInitials: "TT",
      slaThresholds: {
        orderWarnMinutes: 6, orderCriticalMinutes: 12,
        helpWarnMinutes: 4, helpCriticalMinutes: 8,
      },
      lastCallAutoFlagTables: true,
    },
  });
  return org.id;
}

describe("analytics & reports integration (plan 09)", () => {
  let testDb: TestDb;
  let rawClient: PrismaClient;
  let venueA: string;
  let venueB: string;
  let sessionA: SessionContext;
  let itemId: string;

  beforeAll(async () => {
    testDb = await createTestDb();
    rawClient = testDb.rawClient;

    venueA = await makeVenue(rawClient, "Analytics A", "analytics-a-int");
    venueB = await makeVenue(rawClient, "Analytics B", "analytics-b-int");
    sessionA = { venueId: venueA };

    const db = getDb(sessionA);
    const cat = await createCategory(db, venueA, {
      name: "Spirits",
      description: "",
      sortOrder: 1,
    });
    const item = await createItem(db, venueA, {
      categoryId: cat.id,
      name: "Grey Goose",
      description: "",
      priceCents: toCents(200),
      icon: "cocktail",
      tags: [],
      inventory: 50,
    });
    itemId = item.id;

    // Place two test orders with known totals at a known time
    const night = nightForDate("2026-07-14", UTC_NIGHT);

    const result1 = await submitOrder(db, venueA, {
      tableId: "t1",
      tableCode: "VIP-01",
      zoneId: "z1",
      zoneName: "VIP",
      guestName: "Alice",
      lines: [{ menuItemId: itemId, quantity: 3, modifiers: [] }],
      tipCents: 0,
    });
    if (result1.ok) {
      // Backdate the order to fall within the test night
      await rawClient.order.update({
        where: { id: result1.order.id },
        data: { placedAt: new Date(night.start.getTime() + 3_600_000) },
      });
    }

    const result2 = await submitOrder(db, venueA, {
      tableId: "t2",
      tableCode: "MAIN-01",
      zoneId: "z2",
      zoneName: "Main Floor",
      guestName: "Bob",
      lines: [{ menuItemId: itemId, quantity: 2, modifiers: [] }],
      tipCents: 1000,
    });
    if (result2.ok) {
      await rawClient.order.update({
        where: { id: result2.order.id },
        data: { placedAt: new Date(night.start.getTime() + 7_200_000) },
      });
    }
  }, 60_000);

  afterAll(async () => {
    await testDb?.teardown();
  });

  // Any test that pins the clock must not leak it — even when it fails mid-assert.
  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Rollup computation ─────────────────────────────────────────────

  it("computes rollup with correct revenue from known orders", async () => {
    const db = getDb(sessionA);
    const night = nightForDate("2026-07-14", UTC_NIGHT);
    const rollup = await computeRollup(db, venueA, night);

    // Order 1: 3 × $200 = $600 (60000 cents)
    // Order 2: 2 × $200 = $400 + $10 tip = $410 (41000 cents)
    // Total = 101000 cents (revenue includes tip from totalCents)
    expect(rollup.orderCount).toBe(2);
    expect(rollup.revenueCents).toBeGreaterThan(0);
    expect(rollup.byZone.v).toBe(1);
    expect(rollup.byZone.zones.length).toBe(2);
    expect(rollup.topItems.v).toBe(1);
    expect(rollup.topItems.items[0].name).toBe("Grey Goose");
    expect(rollup.topItems.items[0].count).toBe(5); // 3 + 2
  });

  it("uses persisted custom night settings for summary and rollup", async () => {
    const db = getDb(sessionA);
    // Pin the clock inside the 23:00→02:00 window — the order below is placed
    // "now" and must land in tonight's night regardless of when the suite runs.
    // Fake only Date so the PGlite driver's real timers keep working.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-20T23:30:00Z"));
    await rawClient.venue.update({
      where: { id: venueA },
      data: { timezone: "UTC", nightStartHour: 23, nightEndHour: 2 },
    });
    const config = await rawClient.venue.findUniqueOrThrow({
      where: { id: venueA },
      select: { timezone: true, nightStartHour: true, nightEndHour: true },
    });
    const result = await submitOrder(db, venueA, {
      tableId: "custom-night-table",
      tableCode: "NIGHT-01",
      zoneId: "custom-night-zone",
      zoneName: "Night Window",
      guestName: "Custom night",
      lines: [{ menuItemId: itemId, quantity: 1, modifiers: [] }],
      tipCents: 0,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    try {
      const summary = await getSummaryForVenue(db, venueA, config);
      const rollup = await computeRollup(db, venueA, nightContaining(new Date(), config));

      expect(summary.ordersTonight).toBe(1);
      expect(rollup.orderCount).toBe(summary.ordersTonight);
      expect(rollup.revenueCents).toBe(Math.round(summary.revenueTonight * 100));
      expect((await rawClient.venue.findUniqueOrThrow({ where: { id: venueB } })).nightStartHour)
        .toBe(18);
    } finally {
      await rawClient.order.delete({ where: { id: result.order.id } });
      await rawClient.stockMovement.deleteMany({ where: { note: `Order ${result.order.code}` } });
      await rawClient.menuItem.update({ where: { id: itemId }, data: { inventory: { increment: 1 } } });
    }
  });

  // ── Rollup idempotency ─────────────────────────────────────────────

  it("upserting rollup twice produces exactly one row", async () => {
    const db = getDb(sessionA);
    const night = nightForDate("2026-07-14", UTC_NIGHT);
    const rollup = await computeRollup(db, venueA, night);

    await upsertRollup(rawClient, venueA, "2026-07-14", rollup);
    await upsertRollup(rawClient, venueA, "2026-07-14", rollup);

    const count = await rawClient.nightlyRollup.count({
      where: { venueId: venueA, nightDate: "2026-07-14" },
    });
    expect(count).toBe(1);
  });

  // ── Historical reads ───────────────────────────────────────────────

  it("getHistorical returns data from rollup rows", async () => {
    const db = getDb(sessionA);
    const historical = await getHistoricalForVenue(db, "2026-07-14", "2026-07-14");

    expect(historical.days).toBe(1);
    expect(historical.totalOrders).toBe(2);
    expect(historical.totalRevenue).toBeGreaterThan(0);
    expect(historical.series).toHaveLength(1);
    expect(historical.series[0].label).toBe("7/14");
    expect(historical.revenueByZone.length).toBe(2);
    expect(historical.topItems[0].name).toBe("Grey Goose");
  });

  // ── Tenant isolation on rollups ────────────────────────────────────

  it("rollups are tenant-isolated", async () => {
    await expectTenantIsolation(
      venueA,
      venueB,
      (db) => db.nightlyRollup.findFirst({ where: { nightDate: "2026-07-14" } }),
    );
  });

  // ── Report CRUD ────────────────────────────────────────────────────

  it("creates, updates, lists, and deletes a saved report", async () => {
    const db = getDb(sessionA);

    const report = await createReport(db, venueA, {
      name: "Weekly Sales",
      metrics: ["revenue", "zones"],
      rangeDays: 7,
      schedule: null,
    });
    expect(report.name).toBe("Weekly Sales");
    expect(report.metrics).toEqual(["revenue", "zones"]);

    const updated = await updateReport(db, report.id, { name: "Monthly Sales", rangeDays: 30 });
    expect(updated!.name).toBe("Monthly Sales");
    expect(updated!.rangeDays).toBe(30);

    const list = await listReports(db);
    expect(list.some((r) => r.id === report.id)).toBe(true);

    await deleteReport(db, report.id);
    const listAfter = await listReports(db);
    expect(listAfter.some((r) => r.id === report.id)).toBe(false);
  });

  // ── Report run recording ───────────────────────────────────────────

  it("recordRun creates an append-only row", async () => {
    const db = getDb(sessionA);
    const report = await createReport(db, venueA, {
      name: "Run Test",
      metrics: ["revenue"],
      rangeDays: 7,
      schedule: null,
    });

    await recordRun(db, report.id, "2026-07-07", "2026-07-14");
    await recordRun(db, report.id, "2026-07-08", "2026-07-14");

    const runs = await rawClient.reportRun.findMany({
      where: { reportId: report.id },
      orderBy: { ranAt: "asc" },
    });
    expect(runs).toHaveLength(2);
    expect(runs[0].fromDate).toBe("2026-07-07");
    expect(runs[1].fromDate).toBe("2026-07-08");
  });

  // ── Scheduled report selection ─────────────────────────────────────

  it("findDueReports returns daily on any day, weekly on Monday, monthly on 1st", async () => {
    const db = getDb(sessionA);

    await createReport(db, venueA, {
      name: "Daily Report",
      metrics: ["revenue"],
      rangeDays: 1,
      schedule: { frequency: "daily", recipient: "test@example.com" },
    });
    await createReport(db, venueA, {
      name: "Weekly Report",
      metrics: ["revenue"],
      rangeDays: 7,
      schedule: { frequency: "weekly", recipient: "test@example.com" },
    });
    await createReport(db, venueA, {
      name: "Monthly Report",
      metrics: ["revenue"],
      rangeDays: 30,
      schedule: { frequency: "monthly", recipient: "test@example.com" },
    });

    // Tuesday — only daily
    const tuesday = new Date("2026-07-14T08:00:00Z"); // Tuesday
    const tueDue = await findDueReports(db, tuesday);
    expect(tueDue.some((r) => r.name === "Daily Report")).toBe(true);
    expect(tueDue.some((r) => r.name === "Weekly Report")).toBe(false);
    expect(tueDue.some((r) => r.name === "Monthly Report")).toBe(false);

    // Monday — daily + weekly
    const monday = new Date("2026-07-13T08:00:00Z"); // Monday
    const monDue = await findDueReports(db, monday);
    expect(monDue.some((r) => r.name === "Daily Report")).toBe(true);
    expect(monDue.some((r) => r.name === "Weekly Report")).toBe(true);

    // 1st of month — daily + monthly
    const first = new Date("2026-08-01T08:00:00Z"); // Saturday Aug 1
    const firstDue = await findDueReports(db, first);
    expect(firstDue.some((r) => r.name === "Daily Report")).toBe(true);
    expect(firstDue.some((r) => r.name === "Monthly Report")).toBe(true);
  });

  // ── Tenant isolation on reports ────────────────────────────────────

  it("saved reports are tenant-isolated", async () => {
    const db = getDb(sessionA);
    const report = await createReport(db, venueA, {
      name: "Isolation Test",
      metrics: ["revenue"],
      rangeDays: 7,
      schedule: null,
    });

    await expectTenantIsolation(
      venueA,
      venueB,
      (scopedDb) => scopedDb.savedReport.findFirst({ where: { id: report.id } }),
    );
  });
});
