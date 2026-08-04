import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Prisma } from "@prisma/client";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";
import { getDb, type SessionContext } from "@/features/shared/db";

// Regression suite for the tenant-scoping extension's write paths — the
// cross-tenant upsert was a real vulnerability (tips/commission routes took
// venueId from the request body); update/delete/createMany/*OrThrow variants
// were never exercised.

async function makeVenue(raw: TestDb["rawClient"], id: string) {
  await raw.organization.create({ data: { id, name: id, slug: `slug-${id}` } });
  await raw.venue.create({
    data: {
      id, address: "1 Test St", city: "Testville", timezone: "UTC", currency: "CAD",
      openingHours: [], serviceFees: [],
      slaThresholds: { orderWarnMinutes: 6, orderCriticalMinutes: 12, helpWarnMinutes: 4, helpCriticalMinutes: 8 },
      floorMap: { width: 16, height: 9 }, autoApproveGuests: false, logoInitials: "T",
      lastCallAutoFlagTables: true,
    },
  });
  await raw.tenant.create({
    data: { id, name: id, slug: `t-${id}`, plan: "starter", status: "active" },
  });
}

describe("tenant-scoping extension — write paths (integration)", () => {
  let testDb: TestDb;
  const ctxA: SessionContext = { venueId: "scope-a" };
  const ctxB: SessionContext = { venueId: "scope-b" };

  beforeAll(async () => {
    testDb = await createTestDb();
    await makeVenue(testDb.rawClient, "scope-a");
    await makeVenue(testDb.rawClient, "scope-b");
  }, 60_000);

  afterAll(async () => {
    await testDb?.teardown();
  });

  it("upsert scopes the where to the caller's venue — a cross-tenant upsert cannot touch the other venue's row", async () => {
    const raw = testDb.rawClient;
    const dbA = getDb(ctxA);
    const dbB = getDb(ctxB);

    // Venue B owns a tip-pool rule with a known id.
    await raw.tipPoolRule.create({
      data: { id: "rule-shared", venueId: "scope-b", name: "B's rule", basis: "equal", includeRoles: ["runner"], houseRetentionPct: 0, active: true },
    });

    // Venue A upserts the SAME id — the where is scoped to A, so B's row
    // must be untouched and the upsert must NOT create a cross-tenant row
    // (Prisma returns null when the create hits B's PK and the where can't
    // match — a safe no-op, never a write into B).
    const result = await dbA.tipPoolRule.upsert({
      where: { id: "rule-shared" },
      // venueId is deliberately wrong — the extension must inject the caller's.
      create: { id: "rule-shared", venueId: "scope-b", name: "A's rule", basis: "equal", includeRoles: ["runner"], houseRetentionPct: 0, active: true },
      update: { name: "A's rule" },
    });
    expect(result).toBeNull();

    const bRow = await raw.tipPoolRule.findUnique({ where: { id: "rule-shared" } });
    expect(bRow?.name).toBe("B's rule");
    expect(bRow?.venueId).toBe("scope-b");
    expect(await raw.tipPoolRule.count()).toBe(1);
  });

  it("createMany injects the caller's venueId even when the payload names another", async () => {
    const raw = testDb.rawClient;
    const dbA = getDb(ctxA);

    await dbA.tipPoolRule.createMany({
      data: [
        { id: "cm-1", venueId: "scope-b", name: "CM 1", basis: "equal", includeRoles: ["runner"], houseRetentionPct: 0, active: true },
        { id: "cm-2", venueId: "scope-b", name: "CM 2", basis: "equal", includeRoles: ["runner"], houseRetentionPct: 0, active: true },
      ],
    });

    const rows = await raw.tipPoolRule.findMany({ where: { id: { in: ["cm-1", "cm-2"] } } });
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r.venueId).toBe("scope-a");
  });

  it("updateMany/deleteMany scoping: a cross-tenant write matches zero rows", async () => {
    const raw = testDb.rawClient;
    const dbA = getDb(ctxA);
    await raw.tipPoolRule.create({
      data: { id: "rule-b-only", venueId: "scope-b", name: "B only", basis: "equal", includeRoles: ["runner"], houseRetentionPct: 0, active: true },
    });

    const updated = await dbA.tipPoolRule.updateMany({
      where: { id: "rule-b-only" },
      data: { name: "HACKED" },
    });
    expect(updated.count).toBe(0);
    expect((await raw.tipPoolRule.findUnique({ where: { id: "rule-b-only" } }))?.name).toBe("B only");

    const deleted = await dbA.tipPoolRule.deleteMany({ where: { id: "rule-b-only" } });
    expect(deleted.count).toBe(0);
    expect(await raw.tipPoolRule.findUnique({ where: { id: "rule-b-only" } })).not.toBeNull();
  });

  it("findUniqueOrThrow scoped: a cross-tenant lookup throws not-found instead of leaking", async () => {
    const dbA = getDb(ctxA);
    await expect(
      dbA.tipPoolRule.findUniqueOrThrow({ where: { id: "rule-b-only" } }),
    ).rejects.toThrow(Prisma.PrismaClientKnownRequestError);
  });

  it("findFirstOrThrow scoped: same not-found behavior cross-tenant", async () => {
    const dbA = getDb(ctxA);
    await expect(
      dbA.tipPoolRule.findFirstOrThrow({ where: { id: "rule-b-only" } }),
    ).rejects.toThrow();
  });
});
