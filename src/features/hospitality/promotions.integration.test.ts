import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getDb, type SessionContext } from "@/features/shared/db";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";
import {
  listPromotions,
  createPromotion,
  getPromotion,
  updatePromotion,
  deletePromotion,
  validateCode,
} from "@/features/hospitality/promotions-core";
import { expectTenantIsolation } from "@/features/shared/test-helpers";

async function makeVenue(rawClient: PrismaClient, name: string, slug: string) {
  const org = await rawClient.organization.create({ data: { id: `org-${slug}`, name, slug } });
  await rawClient.venue.create({
    data: {
      id: org.id,
      address: "1 Test St",
      city: "Testville",
      timezone: "America/Montreal",
      currency: "CAD",
      openingHours: [],
      serviceFees: [],
      floorMap: { width: 16, height: 9 },
      autoApproveGuests: false,
      logoInitials: "TT",
      slaThresholds: {
        orderWarnMinutes: 6,
        orderCriticalMinutes: 12,
        helpWarnMinutes: 4,
        helpCriticalMinutes: 8,
      },
      lastCallAutoFlagTables: true,
    },
  });
  return org.id;
}

describe("promotions integration (plan 08)", () => {
  let testDb: TestDb;
  let rawClient: PrismaClient;
  let venueA: string;
  let venueB: string;
  let sessionA: SessionContext;

  beforeAll(async () => {
    testDb = await createTestDb();
    rawClient = testDb.rawClient;

    venueA = await makeVenue(rawClient, "Venue A", "promo-a");
    venueB = await makeVenue(rawClient, "Venue B", "promo-b");
    sessionA = { venueId: venueA };
  }, 60_000);

  afterAll(async () => {
    await testDb?.teardown();
  });

  it("CRUD: create, list, get, update, delete", async () => {
    const db = getDb(sessionA);
    const promo = await createPromotion(db, venueA, {
      code: "summer20",
      name: "Summer 20%",
      type: "percentage",
      value: 20,
      appliesToCategoryIds: [],
      startsAt: "2026-06-01T00:00:00Z",
      endsAt: "2026-09-01T00:00:00Z",
    });
    expect(promo.code).toBe("SUMMER20");
    expect(promo.type).toBe("percentage");
    expect(promo.value).toBe(20);

    const list = await listPromotions(db);
    expect(list.some((p) => p.id === promo.id)).toBe(true);

    const fetched = await getPromotion(db, promo.id);
    expect(fetched?.name).toBe("Summer 20%");

    const updated = await updatePromotion(db, promo.id, { name: "Summer Deal", value: 25 });
    expect(updated?.name).toBe("Summer Deal");
    expect(updated?.value).toBe(25);

    await deletePromotion(db, promo.id);
    const afterDelete = await getPromotion(db, promo.id);
    expect(afterDelete).toBeNull();
  });

  it("validateCode returns active promo (case-insensitive)", async () => {
    const db = getDb(sessionA);
    const promo = await createPromotion(db, venueA, {
      code: "NIGHTOWL",
      name: "Night Owl",
      type: "flat",
      value: 10,
      appliesToCategoryIds: [],
      startsAt: "2026-01-01T00:00:00Z",
      endsAt: "2027-12-31T23:59:59Z",
    });

    const found = await validateCode(db, venueA, "nightowl");
    expect(found).not.toBeNull();
    expect(found?.id).toBe(promo.id);

    const mixedCase = await validateCode(db, venueA, "NightOwl");
    expect(mixedCase?.id).toBe(promo.id);
  });

  it("validateCode returns null for expired promo", async () => {
    const db = getDb(sessionA);
    await createPromotion(db, venueA, {
      code: "EXPIRED10",
      name: "Expired",
      type: "percentage",
      value: 10,
      appliesToCategoryIds: [],
      startsAt: "2025-01-01T00:00:00Z",
      endsAt: "2025-12-31T23:59:59Z",
    });

    const result = await validateCode(db, venueA, "EXPIRED10");
    expect(result).toBeNull();
  });

  it("validateCode returns null for scheduled (future) promo", async () => {
    const db = getDb(sessionA);
    await createPromotion(db, venueA, {
      code: "FUTURE50",
      name: "Future Deal",
      type: "percentage",
      value: 50,
      appliesToCategoryIds: [],
      startsAt: "2028-01-01T00:00:00Z",
      endsAt: "2028-12-31T23:59:59Z",
    });

    const result = await validateCode(db, venueA, "FUTURE50");
    expect(result).toBeNull();
  });

  it("validateCode returns null for unknown code", async () => {
    const db = getDb(sessionA);
    const result = await validateCode(db, venueA, "DOESNOTEXIST");
    expect(result).toBeNull();
  });

  it("redemptionCount incremented via raw SQL", async () => {
    const db = getDb(sessionA);
    const promo = await createPromotion(db, venueA, {
      code: "REDEEM1",
      name: "Redeemable",
      type: "flat",
      value: 5,
      appliesToCategoryIds: [],
      startsAt: "2026-01-01T00:00:00Z",
      endsAt: "2027-12-31T23:59:59Z",
    });
    expect(promo.redemptionCount).toBe(0);

    await rawClient.$executeRawUnsafe(
      `UPDATE promotions SET redemption_count = redemption_count + 1 WHERE id = $1`,
      promo.id,
    );

    const after = await getPromotion(db, promo.id);
    expect(after?.redemptionCount).toBe(1);

    await rawClient.$executeRawUnsafe(
      `UPDATE promotions SET redemption_count = redemption_count + 1 WHERE id = $1`,
      promo.id,
    );

    const afterTwo = await getPromotion(db, promo.id);
    expect(afterTwo?.redemptionCount).toBe(2);
  });

  it("tenant isolation: venue B cannot see venue A promotions", async () => {
    const db = getDb(sessionA);
    const promo = await createPromotion(db, venueA, {
      code: "ISOLATE",
      name: "Isolated",
      type: "percentage",
      value: 15,
      appliesToCategoryIds: [],
      startsAt: "2026-01-01T00:00:00Z",
      endsAt: "2027-12-31T23:59:59Z",
    });

    await expectTenantIsolation(venueA, venueB, (scopedDb) =>
      scopedDb.promotion.findUnique({ where: { id: promo.id } }),
    );
  });
});
