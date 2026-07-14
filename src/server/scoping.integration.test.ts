import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getDb, type SessionContext } from "./db";
import { createTestDb, type TestDb } from "./test-pglite";

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
      slaThresholds: { orderWarnMinutes: 6, orderCriticalMinutes: 12, helpWarnMinutes: 4, helpCriticalMinutes: 8 },
      lastCallAutoFlagTables: true,
    },
  });
  return org.id;
}

describe("tenant scoping (AD-3 canary)", () => {
  let testDb: TestDb;
  let rawClient: PrismaClient;

  beforeAll(async () => {
    testDb = await createTestDb();
    rawClient = testDb.rawClient;
  }, 60_000);

  afterAll(async () => {
    await testDb?.teardown();
  });

  it("scoped client cannot read another tenant's zones", async () => {
    const venueA = await makeVenue(rawClient, "Venue A", "scope-a");
    const venueB = await makeVenue(rawClient, "Venue B", "scope-b");

    // Create a zone in each venue via raw client (bypasses scoping)
    await rawClient.zone.create({
      data: { venueId: venueA, name: "VIP-A", color: "violet" },
    });
    await rawClient.zone.create({
      data: { venueId: venueB, name: "VIP-B", color: "cyan" },
    });

    const dbA = getDb({ venueId: venueA });
    const dbB = getDb({ venueId: venueB });

    const zonesA = await dbA.zone.findMany();
    const zonesB = await dbB.zone.findMany();

    expect(zonesA).toHaveLength(1);
    expect(zonesA[0].name).toBe("VIP-A");
    expect(zonesB).toHaveLength(1);
    expect(zonesB[0].name).toBe("VIP-B");
  });
});
