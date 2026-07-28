import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getDb, type SessionContext } from "../features/shared/db";
import { createTestDb, type TestDb } from "../features/shared/test-pglite";
import {
  getVenue,
  updateVenue,
  listZones,
  createZone,
  updateZone,
  deleteZone,
  listTables,
  createTable,
  updateTable,
  deleteTable,
  setTableStatus,
  setTablePosition,
} from "./venue-core";
import { listShifts, addShift, removeShift } from "./shift-core";
import { expectTenantIsolation } from "../features/shared/test-helpers";
import { verifyTableToken } from "../features/shared/table-token";

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

describe("venue/zone/table/shift integration (plan 03)", () => {
  let testDb: TestDb;
  let rawClient: PrismaClient;
  let venueA: string;
  let venueB: string;
  let sessionA: SessionContext;

  beforeAll(async () => {
    testDb = await createTestDb();
    rawClient = testDb.rawClient;

    venueA = await makeVenue(rawClient, "Venue A", "venue-a-int");
    venueB = await makeVenue(rawClient, "Venue B", "venue-b-int");
    await rawClient.user.create({
      data: { id: "st-test", name: "Shift Tester", email: "shift@test.local" },
    });
    sessionA = { venueId: venueA };
  }, 60_000);

  afterAll(async () => {
    await testDb?.teardown();
  });

  it("gets and updates venue config, including the organization name", async () => {
    const db = getDb(sessionA);
    const before = await getVenue(db, venueA);
    expect(before?.name).toBe("Venue A");
    expect(before?.currency).toBe("CAD");

    const updated = await updateVenue(db, venueA, {
      name: "Venue A Renamed",
      autoApproveGuests: true,
      timezone: "America/Vancouver",
      nightStartHour: 20,
      nightEndHour: 6,
      openingHours: [{ day: "Friday", open: "20:00", close: "04:00" }],
    });
    expect(updated.name).toBe("Venue A Renamed");
    expect(updated.autoApproveGuests).toBe(true);
    expect(updated.city).toBe("Testville");
    expect(updated.timezone).toBe("America/Vancouver");
    expect(updated.nightStartHour).toBe(20);
    expect(updated.nightEndHour).toBe(6);
    expect(updated.openingHours).toEqual([{ day: "Friday", open: "20:00", close: "04:00" }]);
  });

  it("creates, lists and updates zones with a derived tableCount", async () => {
    const db = getDb(sessionA);
    const zone = await createZone(db, venueA, { name: "Patio", description: "Outside", color: "cyan" });
    expect(zone.tableCount).toBe(0);

    const table = await createTable(db, venueA, {
      zoneId: zone.id,
      code: "P-01",
      label: "Patio 1",
      seats: 4,
      minimumSpend: null,
      status: "open",
    });
    expect(verifyTableToken(table.qrSlug, (id) => id === table.id ? 0 : null)).toEqual({
      valid: true,
      tableId: table.id,
    });

    const zones = await listZones(db);
    const patio = zones.find((z) => z.id === zone.id);
    expect(patio?.tableCount).toBe(1);

    const renamed = await updateZone(db, zone.id, { name: "Patio Renamed" });
    expect(renamed?.name).toBe("Patio Renamed");

    await deleteTable(db, table.id);
  });

  it("rejects deleting a zone that still has tables (INV-V1)", async () => {
    const db = getDb(sessionA);
    const zone = await createZone(db, venueA, { name: "Blocked Zone", description: "", color: "amber" });
    const table = await createTable(db, venueA, {
      zoneId: zone.id,
      code: "BZ-01",
      label: "Table 1",
      seats: 2,
      minimumSpend: null,
      status: "open",
    });

    const blocked = await deleteZone(db, zone.id);
    expect(blocked).toEqual({ ok: false, blockedBy: 1 });

    await deleteTable(db, table.id);
    const allowed = await deleteZone(db, zone.id);
    expect(allowed).toEqual({ ok: true });
  });

  it("persists table status and floor-map position", async () => {
    const db = getDb(sessionA);
    const zone = await createZone(db, venueA, { name: "Status Zone", description: "", color: "rose" });
    const table = await createTable(db, venueA, {
      zoneId: zone.id,
      code: "SZ-01",
      label: "Table 1",
      seats: 2,
      minimumSpend: null,
      status: "open",
    });

    const occupied = await setTableStatus(db, table.id, "occupied");
    expect(occupied?.status).toBe("occupied");

    await setTablePosition(db, table.id, 150, -20);
    const tables = await listTables(db, zone.id);
    const persisted = tables.find((t) => t.id === table.id);
    expect(persisted?.mapX).toBe(98);
    expect(persisted?.mapY).toBe(2);

    const patched = await updateTable(db, table.id, { label: "Renamed table" });
    expect(patched?.label).toBe("Renamed table");
  });

  it("keeps shifts scoped per venue", async () => {
    const db = getDb(sessionA);
    const shift = await addShift(db, venueA, {
      staffId: "st-test",
      dayOfWeek: 5,
      startTime: "22:00",
      endTime: "04:00",
      zoneId: null,
    });

    const shifts = await listShifts(db);
    expect(shifts.some((s) => s.id === shift.id)).toBe(true);

    await removeShift(db, shift.id);
    const afterRemove = await listShifts(db);
    expect(afterRemove.some((s) => s.id === shift.id)).toBe(false);
  });

  it("never leaks zones or tables across venues (AD-3 canary)", async () => {
    const dbB = getDb({ venueId: venueB });
    const marker = await createZone(dbB, venueB, { name: "Venue B Zone", description: "", color: "violet" });

    await expectTenantIsolation(venueB, venueA, (db) =>
      db.zone.findUnique({ where: { id: marker.id } }),
    );
  });
});
