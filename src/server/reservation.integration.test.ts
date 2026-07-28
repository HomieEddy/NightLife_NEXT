import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getDb, type SessionContext } from "../features/shared/db";
import { createTestDb, type TestDb } from "../features/shared/test-pglite";
import {
  listReservations,
  createReservation,
  getReservation,
  updateReservation,
  setReservationStatus,
} from "@/features/hospitality/reservation-core";
import { createZone, createTable, setTableStatus } from "@/features/venue/core";
import { expectTenantIsolation } from "../features/shared/test-helpers";

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

describe("reservation integration (plan 08)", () => {
  let testDb: TestDb;
  let rawClient: PrismaClient;
  let venueA: string;
  let venueB: string;
  let sessionA: SessionContext;
  let zoneId: string;
  let tableId: string;

  beforeAll(async () => {
    testDb = await createTestDb();
    rawClient = testDb.rawClient;

    venueA = await makeVenue(rawClient, "Venue A", "res-a");
    venueB = await makeVenue(rawClient, "Venue B", "res-b");
    sessionA = { venueId: venueA };

    const db = getDb(sessionA);
    const zone = await createZone(db, venueA, { name: "Main", description: "", color: "cyan" });
    zoneId = zone.id;
    const table = await createTable(db, venueA, {
      zoneId,
      code: "M-01",
      label: "Main 1",
      seats: 4,
      minimumSpend: null,
      status: "open",
    });
    tableId = table.id;
  }, 60_000);

  afterAll(async () => {
    await testDb?.teardown();
  });

  it("creates, lists and retrieves a reservation", async () => {
    const db = getDb(sessionA);
    const res = await createReservation(db, venueA, {
      guestName: "Alice",
      partySize: 4,
      startsAt: "2026-08-01T21:00:00Z",
      tableId,
      zoneId,
      note: "Birthday",
      source: "manager",
    });
    expect(res.guestName).toBe("Alice");
    expect(res.status).toBe("requested");

    const fetched = await getReservation(db, res.id);
    expect(fetched?.id).toBe(res.id);

    const list = await listReservations(db);
    expect(list.some((r) => r.id === res.id)).toBe(true);
  });

  it("updates reservation fields", async () => {
    const db = getDb(sessionA);
    const res = await createReservation(db, venueA, {
      guestName: "Bob",
      partySize: 2,
      startsAt: "2026-08-02T20:00:00Z",
      source: "manager",
    });

    const updated = await updateReservation(db, res.id, { partySize: 6, note: "VIP" });
    expect(updated?.partySize).toBe(6);
    expect(updated?.note).toBe("VIP");
  });

  it("confirmed → seated flips table to occupied", async () => {
    const db = getDb(sessionA);
    await setTableStatus(db, tableId, "open");

    const res = await createReservation(db, venueA, {
      guestName: "Charlie",
      partySize: 2,
      startsAt: "2026-08-01T22:00:00Z",
      tableId,
      zoneId,
      source: "manager",
    });

    const confirmed = await setReservationStatus(db, venueA, res.id, "confirmed");
    expect(confirmed.ok).toBe(true);
    if (confirmed.ok) expect(confirmed.reservation.status).toBe("confirmed");

    const seated = await setReservationStatus(db, venueA, res.id, "seated");
    expect(seated.ok).toBe(true);
    if (seated.ok) {
      expect(seated.reservation.status).toBe("seated");
    }
  });

  it("completed releases the table back to open", async () => {
    const db = getDb(sessionA);
    await setTableStatus(db, tableId, "open");

    const res = await createReservation(db, venueA, {
      guestName: "Diana",
      partySize: 2,
      startsAt: "2026-08-01T23:00:00Z",
      tableId,
      zoneId,
      source: "manager",
    });

    await setReservationStatus(db, venueA, res.id, "confirmed");
    await setReservationStatus(db, venueA, res.id, "seated");
    const completed = await setReservationStatus(db, venueA, res.id, "completed");
    expect(completed.ok).toBe(true);
    if (completed.ok) expect(completed.reservation.status).toBe("completed");
  });

  it("cancelled releases the table back to open", async () => {
    const db = getDb(sessionA);
    await setTableStatus(db, tableId, "open");

    const res = await createReservation(db, venueA, {
      guestName: "Eve",
      partySize: 2,
      startsAt: "2026-08-02T21:00:00Z",
      tableId,
      zoneId,
      source: "manager",
    });

    await setReservationStatus(db, venueA, res.id, "confirmed");
    const cancelled = await setReservationStatus(db, venueA, res.id, "cancelled");
    expect(cancelled.ok).toBe(true);
    if (cancelled.ok) expect(cancelled.reservation.status).toBe("cancelled");
  });

  it("tenant isolation: venue B cannot see venue A reservations", async () => {
    const db = getDb(sessionA);
    const res = await createReservation(db, venueA, {
      guestName: "Isolated Guest",
      partySize: 1,
      startsAt: "2026-09-01T20:00:00Z",
      source: "manager",
    });

    await expectTenantIsolation(venueA, venueB, (scopedDb) =>
      scopedDb.reservation.findUnique({ where: { id: res.id } }),
    );
  });
});
