import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getDb, type SessionContext } from "@/features/shared/db";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";
import {
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  listEventGuests,
  addEventGuest,
  removeEventGuest,
} from "@/features/hospitality/events-core";
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

describe("events + guestlist integration (plan 08)", () => {
  let testDb: TestDb;
  let rawClient: PrismaClient;
  let venueA: string;
  let venueB: string;
  let sessionA: SessionContext;

  beforeAll(async () => {
    testDb = await createTestDb();
    rawClient = testDb.rawClient;

    venueA = await makeVenue(rawClient, "Venue A", "evt-a");
    venueB = await makeVenue(rawClient, "Venue B", "evt-b");
    sessionA = { venueId: venueA };
  }, 60_000);

  afterAll(async () => {
    await testDb?.teardown();
  });

  it("creates, lists, updates and deletes an event", async () => {
    const db = getDb(sessionA);
    const evt = await createEvent(db, venueA, {
      name: "Friday Night",
      description: "Weekly party",
      startsAt: "2026-08-07T22:00:00Z",
      endsAt: "2026-08-08T04:00:00Z",
      status: "draft",
      capacity: 200,
      guestlistEnabled: true,
    });
    expect(evt.name).toBe("Friday Night");
    expect(evt.status).toBe("draft");

    const list = await listEvents(db);
    expect(list.some((e) => e.id === evt.id)).toBe(true);

    const updated = await updateEvent(db, evt.id, { name: "Friday Night Special", status: "published" });
    expect(updated?.name).toBe("Friday Night Special");
    expect(updated?.status).toBe("published");

    await deleteEvent(db, evt.id);
    const afterDelete = await listEvents(db);
    expect(afterDelete.some((e) => e.id === evt.id)).toBe(false);
  });

  it("manages guestlist: add, list, remove", async () => {
    const db = getDb(sessionA);
    const evt = await createEvent(db, venueA, {
      name: "Guestlist Night",
      description: "VIP event",
      startsAt: "2026-08-14T22:00:00Z",
      endsAt: "2026-08-15T04:00:00Z",
      status: "draft",
      capacity: 100,
      guestlistEnabled: true,
    });

    const guest1 = await addEventGuest(db, { eventId: evt.id, name: "Alice", partySize: 3 });
    expect(guest1.name).toBe("Alice");
    expect(guest1.partySize).toBe(3);

    const guest2 = await addEventGuest(db, { eventId: evt.id, name: "Bob", partySize: 1 });
    expect(guest2.name).toBe("Bob");

    const guests = await listEventGuests(db, evt.id);
    expect(guests).toHaveLength(2);
    expect(guests.map((g) => g.name).sort()).toEqual(["Alice", "Bob"]);

    await removeEventGuest(db, guest1.id);
    const afterRemove = await listEventGuests(db, evt.id);
    expect(afterRemove).toHaveLength(1);
    expect(afterRemove[0].name).toBe("Bob");

    await deleteEvent(db, evt.id);
  });

  it("tenant isolation: venue B cannot see venue A events", async () => {
    const db = getDb(sessionA);
    const evt = await createEvent(db, venueA, {
      name: "Isolated Event",
      description: "Test isolation",
      startsAt: "2026-09-01T21:00:00Z",
      endsAt: "2026-09-02T03:00:00Z",
      status: "draft",
      capacity: 50,
      guestlistEnabled: false,
    });

    await expectTenantIsolation(venueA, venueB, (scopedDb) =>
      scopedDb.venueEvent.findUnique({ where: { id: evt.id } }),
    );
  });
});
