import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getDb, type SessionContext } from "@/features/shared/db";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";
import { expectTenantIsolation } from "@/features/shared/test-helpers";
import {
  getTipPoolRule,
  saveTipPoolRule,
  listTipDistributions,
  getTipDistribution,
  saveTipDistribution,
  closeTipDistribution,
} from "@/features/workforce/tips-core";
import type { TipDistribution, TipPoolRule } from "@/lib/types";

async function makeVenue(prisma: PrismaClient, id: string) {
  await prisma.organization.create({ data: { id, name: id, slug: id } });
  await prisma.venue.create({
    data: {
      id, address: "1 Test", city: "Test", timezone: "UTC", currency: "USD",
      openingHours: [], serviceFees: [], floorMap: { width: 16, height: 9 },
      autoApproveGuests: false, logoInitials: "TT",
      slaThresholds: { orderWarnMinutes: 6, orderCriticalMinutes: 12, helpWarnMinutes: 4, helpCriticalMinutes: 8 },
      lastCallAutoFlagTables: true,
    },
  });
}

describe("tip pool integration (plan 18, WS-4)", () => {
  let testDb: TestDb;
  let prisma: PrismaClient;
  const venueA = "tips-venue-a";
  const venueB = "tips-venue-b";
  let sessionA: SessionContext;

  beforeAll(async () => {
    testDb = await createTestDb();
    prisma = testDb.rawClient;
    await makeVenue(prisma, venueA);
    await makeVenue(prisma, venueB);
    sessionA = { venueId: venueA };
  }, 60_000);

  afterAll(async () => {
    await testDb?.teardown();
  });

  it("creates a tip pool rule and reads it back as the active rule", async () => {
    const db = getDb(sessionA);
    const rule: TipPoolRule = {
      id: "rule-1", venueId: venueA, name: "Standard pool", basis: "hours-weighted",
      includeRoles: ["bartender", "runner", "host"], houseRetentionPct: 0, active: true,
    };
    const saved = await saveTipPoolRule(db, rule);
    expect(saved.basis).toBe("hours-weighted");

    const active = await getTipPoolRule(db);
    expect(active?.id).toBe("rule-1");
  });

  it("upserts a rule in place rather than duplicating it", async () => {
    const db = getDb(sessionA);
    const rule: TipPoolRule = {
      id: "rule-1", venueId: venueA, name: "Standard pool (renamed)", basis: "equal",
      includeRoles: ["bartender"], houseRetentionPct: 5, active: true,
    };
    const saved = await saveTipPoolRule(db, rule);
    expect(saved.name).toBe("Standard pool (renamed)");
    expect(saved.basis).toBe("equal");

    const rows = await prisma.tipPoolRule.findMany({ where: { venueId: venueA } });
    expect(rows.length).toBe(1);
  });

  it("saves a distribution and lists it by business date (INV-W2 lands intact via the pure function)", async () => {
    const db = getDb(sessionA);
    const dist: TipDistribution = {
      id: "dist-1", venueId: venueA, businessDate: "2026-08-01", ruleId: "rule-1",
      poolCents: 10001,
      lines: [
        { staffId: "st-a", basisValue: 480, shareCents: 6001 },
        { staffId: "st-b", basisValue: 240, shareCents: 4000 },
      ],
      computedAt: new Date().toISOString(),
      closedByStaffId: "st-mgr",
    };
    await saveTipDistribution(db, dist);

    const byDate = await getTipDistribution(db, "2026-08-01");
    expect(byDate?.poolCents).toBe(10001);
    expect(byDate?.lines.reduce((s, l) => s + l.shareCents, 0)).toBe(10001);

    const list = await listTipDistributions(db);
    expect(list.some((d) => d.id === "dist-1")).toBe(true);
  });

  it("closing a distribution records who closed it and when", async () => {
    const db = getDb(sessionA);
    const before = await getTipDistribution(db, "2026-08-01");
    expect(before).not.toBeNull();

    const closed = await closeTipDistribution(db, before!.id, "st-owner");
    expect(closed.closedByStaffId).toBe("st-owner");
  });

  it("a tenant cannot read another venue's tip pool rule by id", async () => {
    await saveTipPoolRule(getDb({ venueId: venueB }), {
      id: "rule-b1", venueId: venueB, name: "B's rule", basis: "equal",
      includeRoles: ["bartender"], houseRetentionPct: 0, active: true,
    });

    // Scoped by venueB's own db (owner) vs venueA's (other) — the Prisma
    // extension injects venueId into the where clause either way.
    await expectTenantIsolation(venueB, venueA, (scoped) =>
      scoped.tipPoolRule.findFirst({ where: { id: "rule-b1" } }),
    );
  });

  it("a tenant cannot read another venue's tip distribution", async () => {
    await expectTenantIsolation(venueA, venueB, (scoped) => getTipDistribution(scoped, "2026-08-01"));
  });
});
