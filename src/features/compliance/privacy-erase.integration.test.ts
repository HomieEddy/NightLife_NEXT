import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";
import {
  locateByEmail,
  eraseGuestData,
  type PersonMatch,
} from "../../../scripts/privacy-erase";

// The script's locate/erase functions run against the PGlite-backed Prisma
// singleton (getRawPrisma shares createTestDb's client).

async function makeVenue(raw: TestDb["rawClient"], id: string, slug: string) {
  await raw.organization.create({ data: { id, name: slug, slug } });
  await raw.venue.create({
    data: {
      id, address: "1 Test St", city: "Testville", timezone: "America/Montreal",
      currency: "CAD", openingHours: [], serviceFees: [], slaThresholds: {
        orderWarnMinutes: 6, orderCriticalMinutes: 12, helpWarnMinutes: 4, helpCriticalMinutes: 8,
      },
      floorMap: { width: 16, height: 9 }, autoApproveGuests: false, logoInitials: "T",
      lastCallAutoFlagTables: true,
    },
  });
  await raw.tenant.create({
    data: { id, name: slug, slug: `t-${slug}`, plan: "starter", status: "active" },
  });
}

describe("privacy-erase (integration)", () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await createTestDb();
    await makeVenue(testDb.rawClient, "era-a", "venue-a");
    await makeVenue(testDb.rawClient, "era-b", "venue-b");
  }, 60_000);

  afterAll(async () => {
    await testDb?.teardown();
  });

  it("locates a subject across profiles, sessions, reservations, leads, and logs", async () => {
    const raw = testDb.rawClient;
    await raw.guestProfile.create({
      data: { id: "gp-erase", venueId: "era-a", displayName: "Jean Dupont", firstName: "Jean", email: "jean@example.com", phone: "555-0100" },
    });
    await raw.guestSession.create({
      data: { id: "gs-erase", venueId: "era-a", tableId: "t1", tableCode: "A1", zoneName: "Main", displayName: "Jean", guestProfileId: "gp-erase", status: "closed", partySize: 2 },
    });
    await raw.reservation.create({
      data: { id: "res-erase", venueId: "era-a", guestName: "Jean Dupont", guestEmail: "jean@example.com", partySize: 2, startsAt: new Date("2026-08-10T22:00:00Z"), status: "confirmed", source: "public" },
    });
    await raw.lead.create({
      data: { id: "lead-erase", email: "jean@example.com", source: "landing-page", venueName: "Venue A", contactName: "Jean" },
    });
    await raw.notificationLog.create({
      data: { id: "nl-erase", venueId: "era-a", channel: "email", template: "reservation-confirmation", recipient: "jean@example.com", status: "sent" },
    });

    const match = await locateByEmail(testDb.rawClient, "jean@example.com");
    expect(match.guestProfiles).toContain("gp-erase");
    expect(match.guestSessions).toContain("gs-erase");
    expect(match.reservations).toContain("res-erase");
    expect(match.leads).toContain("lead-erase");
    expect(match.notificationLogs).toBeGreaterThan(0);
    expect(match.venueIds).toContain("era-a");
  });

  it("erases the subject and scrubs orders/bar tabs while keeping money rows", async () => {
    const raw = testDb.rawClient;
    await raw.order.create({
      data: { id: "ord-erase", venueId: "era-a", code: "A-001", tableId: "t1", tableCode: "A1", zoneId: "z1", zoneName: "Main", guestName: "Jean Dupont", sessionId: "gs-erase", subtotalCents: 10000, discountCents: 0, totalFeeCents: 1500, tipCents: 2000, totalCents: 13500, status: "delivered" },
    });
    await raw.barTab.create({
      data: { id: "bt-erase", venueId: "era-a", guestProfileId: "gp-erase", guestName: "Jean Dupont", status: "closed", openedByStaffId: "stf-1", openedByStaffName: "Staff", openedAt: new Date("2026-08-01T20:00:00Z") },
    });

    const match = await locateByEmail(testDb.rawClient, "jean@example.com");
    await eraseGuestData(testDb.rawClient, match);

    // Money rows survive, identity does not.
    const order = await raw.order.findUnique({ where: { id: "ord-erase" } });
    expect(order).not.toBeNull();
    expect(order?.guestName).toBe("[erased]");
    expect(order?.totalCents).toBe(13500);
    const tab = await raw.barTab.findUnique({ where: { id: "bt-erase" } });
    expect(tab?.guestName).toBe("[erased]");

    // Reservation anonymized, lead deleted, profile deleted last.
    expect((await raw.reservation.findUnique({ where: { id: "res-erase" } }))?.guestEmail).toBeNull();
    expect(await raw.lead.findUnique({ where: { id: "lead-erase" } })).toBeNull();
    expect(await raw.guestProfile.findUnique({ where: { id: "gp-erase" } })).toBeNull();
    // Session anonymized (operational record survives).
    expect((await raw.guestSession.findUnique({ where: { id: "gs-erase" } }))?.displayName).toBe("");
    // Subject's log recipient truncated.
    expect((await raw.notificationLog.findUnique({ where: { id: "nl-erase" } }))?.recipient).toBe("");
  });

  it("never truncates another venue's logs with the same recipient", async () => {
    const raw = testDb.rawClient;
    // Same email in venue B — must survive an erasure of the venue-A subject.
    await raw.notificationLog.create({
      data: { id: "nl-other-venue", venueId: "era-b", channel: "email", template: "reservation-confirmation", recipient: "jean@example.com", status: "sent" },
    });

    const match: PersonMatch = {
      guestProfiles: [], guestSessions: [], reservations: [],
      leads: [], incidents: [], admissions: [], notificationLogs: 1,
      notificationRecipient: "jean@example.com",
      venueIds: ["era-a"],
      waitlist: [], eventGuests: [], staffProfiles: [], users: [],
    };
    await eraseGuestData(testDb.rawClient, match);

    expect((await raw.notificationLog.findUnique({ where: { id: "nl-other-venue" } }))?.recipient)
      .toBe("jean@example.com");
  });
});
