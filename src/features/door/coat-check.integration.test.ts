import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";
import { getDb, type SessionContext } from "@/features/shared/db";
import { expectTenantIsolation } from "@/features/shared/test-helpers";
import {
  listCoatCheckTickets,
  checkInCoat,
  claimCoat,
  reportLostTicket,
  reportLostItem,
  resolveClaim,
} from "@/features/door/core";

async function makeVenue(prisma: PrismaClient, id: string) {
  await prisma.organization.create({ data: { id, name: id, slug: id } });
  await prisma.venue.create({
    data: {
      id, address: "1 Test St", city: "Testville", timezone: "America/Toronto", currency: "CAD",
      openingHours: [], serviceFees: [], floorMap: { width: 16, height: 9 },
      autoApproveGuests: false, logoInitials: "TT",
      slaThresholds: { orderWarnMinutes: 6, orderCriticalMinutes: 12, helpWarnMinutes: 4, helpCriticalMinutes: 8 },
      lastCallAutoFlagTables: true, nightEndHour: 6,
    },
  });
}

describe("coat check integration (plan 17, DO-10, WS-2)", () => {
  let testDb: TestDb;
  let prisma: PrismaClient;
  const venueA = "coat-venue-a";
  const venueB = "coat-venue-b";
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

  it("checks in a coat and assigns sequential ticket numbers per business date", async () => {
    const db = getDb(sessionA);
    const first = await checkInCoat(db, venueA, { itemCount: 2, staffId: "st-1" });
    const second = await checkInCoat(db, venueA, { itemCount: 1, staffId: "st-1" });

    expect(second.ticketNumber).toBe(first.ticketNumber + 1);
    expect(first.claimedAt).toBeUndefined();
  });

  it("lists tickets for the current business date", async () => {
    const db = getDb(sessionA);
    const list = await listCoatCheckTickets(db, venueA);
    expect(list.length).toBe(2);
  });

  it("claiming a ticket stamps claimedAt and returns null on a second attempt", async () => {
    const db = getDb(sessionA);
    const [ticket] = await listCoatCheckTickets(db, venueA);

    const claimed = await claimCoat(db, ticket.id);
    expect(claimed?.claimedAt).toBeDefined();

    const secondClaim = await claimCoat(db, ticket.id);
    expect(secondClaim).toBeNull();
  });

  it("claiming a ticket that does not exist returns null", async () => {
    const db = getDb(sessionA);
    expect(await claimCoat(db, "no-such-ticket")).toBeNull();
  });

  it("reports a lost ticket and a lost item as separate claim types", async () => {
    const db = getDb(sessionA);
    const lostTicket = await reportLostTicket(db, venueA, "Guest lost their claim ticket", "Nina");
    expect(lostTicket.claimType).toBe("lost-ticket");
    expect(lostTicket.resolvedAt).toBeUndefined();

    const [existing] = await listCoatCheckTickets(db, venueA);
    const lostItem = await reportLostItem(db, venueA, existing.id, "Missing one glove", "Nina");
    expect(lostItem.claimType).toBe("lost-item");
  });

  it("resolves a claim and refuses to resolve it twice", async () => {
    const db = getDb(sessionA);
    const claim = await reportLostTicket(db, venueA, "Another lost ticket", "Karim");

    const resolved = await resolveClaim(db, claim.id, "Found in coat rack B", "st-mgr");
    expect(resolved?.resolution).toBe("Found in coat rack B");
    expect(resolved?.resolvedByStaffId).toBe("st-mgr");

    const secondResolve = await resolveClaim(db, claim.id, "Already resolved", "st-mgr-2");
    expect(secondResolve).toBeNull();
  });

  it("resolving a claim that does not exist returns null", async () => {
    const db = getDb(sessionA);
    expect(await resolveClaim(db, "no-such-claim", "found it", "st-mgr")).toBeNull();
  });

  it("a tenant cannot claim another venue's coat check ticket", async () => {
    const otherTicket = await checkInCoat(getDb({ venueId: venueB }), venueB, {
      itemCount: 1, staffId: "st-b",
    });

    await expectTenantIsolation(venueB, venueA, (scoped) =>
      scoped.coatCheckTicket.findFirst({ where: { id: otherTicket.id } }),
    );

    // claimCoat has no venueId filter of its own — confirm the venue-scoped
    // client is what actually stops a cross-tenant claim, not app logic.
    const claimedFromWrongTenant = await claimCoat(getDb(sessionA), otherTicket.id);
    expect(claimedFromWrongTenant).toBeNull();
  });

  it("a tenant cannot resolve another venue's coat check claim", async () => {
    const otherClaim = await reportLostTicket(getDb({ venueId: venueB }), venueB, "B's claim", "St B");

    const resolvedFromWrongTenant = await resolveClaim(getDb(sessionA), otherClaim.id, "nope", "st-mgr");
    expect(resolvedFromWrongTenant).toBeNull();
  });
});
