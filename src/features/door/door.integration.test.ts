import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";
import { getDb } from "@/features/shared/db";
import { expectTenantIsolation } from "@/features/shared/test-helpers";
import {
  getOccupancy,
  adjustOccupancy,
  createAdmission,
  createReEntry,
  recordExit,
  getEvacuationState,
  evacuate,
  resumeEvacuation,
  getZoneOccupancy,
  checkZoneCapacity,
  recordRefusal,
  listRefusals,
  listOccupancyEvents,
  getAdmission,
} from "@/features/door/core";

async function makeVenue(prisma: PrismaClient, id: string) {
  await prisma.organization.create({ data: { id, name: id, slug: id } });
  await prisma.venue.create({
    data: {
      id,
      address: "1 Test St",
      city: "Testville",
      timezone: "America/Toronto",
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
      nightEndHour: 6,
    },
  });
}

async function seedZone(prisma: PrismaClient, venueId: string, id: string, name: string) {
  await prisma.zone.upsert({
    where: { id },
    create: { id, venueId, name, color: "#60a5fa" },
    update: {},
  });
}

describe("door integration", () => {
  let testDb: TestDb;
  let prisma: PrismaClient;
  const venueA = "door-venue-a";
  const venueB = "door-venue-b";

  beforeAll(async () => {
    testDb = await createTestDb();
    prisma = testDb.rawClient;
    await makeVenue(prisma, venueA);
    await makeVenue(prisma, venueB);
    await seedZone(prisma, venueA, "zone-a", "Main Floor");
    await seedZone(prisma, venueA, "zone-b", "Rooftop");
    // seed tables via raw Prisma (no seedTable helper — avoids hold_reason)
    await prisma.venueTable.upsert({
      where: { id: "table-a" },
      create: { id: "table-a", venueId: venueA, zoneId: "zone-a", code: "A1", label: "Table A1", status: "open", seats: 4, qrSlug: "qr-table-a" },
      update: {},
    });
  }, 60_000);

  afterAll(async () => testDb?.teardown());

  // ── Occupancy ────────────────────────────────────────────────────────

  it("starts at zero occupancy", async () => {
    const db = getDb({ venueId: venueA });
    const occ = await getOccupancy(db, venueA);
    expect(occ.current).toBe(0);
  });

  it("adjusts occupancy and records an event", async () => {
    const db = getDb({ venueId: venueA });
    const result = await adjustOccupancy(db, venueA, {
      delta: 10,
      reason: "walk-in group",
      staffId: "staff-1",
    });
    expect(result.ok).toBe(true);
    expect(result.current).toBe(10);

    const events = await listOccupancyEvents(db, venueA);
    expect(events.some((e) => e.delta === 10)).toBe(true);
  });

  it("does not allow negative occupancy", async () => {
    const db = getDb({ venueId: venueA });
    const result = await adjustOccupancy(db, venueA, {
      delta: -50,
      reason: "over-release",
      staffId: "staff-1",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("isolates occupancy events by tenant", async () => {
    const dbA = getDb({ venueId: venueA });
    await adjustOccupancy(dbA, venueA, {
      delta: 1,
      reason: "tenant isolation marker",
      staffId: "staff-iso",
    });

    await expectTenantIsolation(venueA, venueB, async (db) =>
      db.occupancyEvent.findFirst({ where: { reason: "tenant isolation marker" } }),
    );
  });

  // ── Admissions ───────────────────────────────────────────────────────

  it("admits a guest and records an admission", async () => {
    const db = getDb({ venueId: venueA });
    const admission = await createAdmission(db, venueA, {
      partySize: 1,
      admissionType: "cover",
      amountOwedCents: 0,
      source: "walk-in",
      staffId: "staff-1",
      staffName: "Rae Runner",
      idCheck: { checked: true, dobVerified: true, yearOfBirth: 2001 },
    });
    expect(admission.id).toBeDefined();
    expect(admission.partySize).toBe(1);

    const fetched = await getAdmission(db, admission.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.partySize).toBe(1);
  });

  it("blocks admission of underage guest", async () => {
    const db = getDb({ venueId: venueA });
    await expect(
      createAdmission(db, venueA, {
        partySize: 1,
        admissionType: "cover",
        amountOwedCents: 0,
        source: "walk-in",
        staffId: "staff-1",
        staffName: "Rae Runner",
        idCheck: { checked: true, dobVerified: true, yearOfBirth: 2020 },
      }),
    ).rejects.toThrow(/age/i);
  });

  it("records exits and allows re-entry", async () => {
    const db = getDb({ venueId: venueA });
    const admission = await createAdmission(db, venueA, {
      partySize: 1,
      admissionType: "cover",
      amountOwedCents: 0,
      source: "walk-in",
      staffId: "staff-1",
      staffName: "Rae Runner",
    });

    const exited = await recordExit(db, venueA, admission.id, "staff-1");
    expect(exited?.exitedAt).toBeDefined();

    const reEntry = await createReEntry(db, venueA, admission.id, "staff-1", "Rae Runner");
    expect(reEntry?.id).toBeDefined();
  });

  it("isolates admissions by tenant", async () => {
    const dbA = getDb({ venueId: venueA });
    const admission = await createAdmission(dbA, venueA, {
      partySize: 1,
      admissionType: "cover",
      amountOwedCents: 0,
      source: "walk-in",
      staffId: "staff-iso",
      staffName: "Isolation Staff",
    });

    await expectTenantIsolation(venueA, venueB, async (db) =>
      db.admission.findUnique({ where: { id: admission.id } }),
    );
  });

  // ── Evacuation ────────────────────────────────────────────────────────

  it("evacuates and blocks new admissions", async () => {
    const db = getDb({ venueId: venueA });
    await evacuate(db, venueA, "staff-1", "Rae Runner");
    const state = await getEvacuationState(db, venueA);
    expect(state.state).toBe("evacuated");

    await expect(
      createAdmission(db, venueA, {
        partySize: 1,
        admissionType: "cover",
        amountOwedCents: 0,
        source: "walk-in",
        staffId: "staff-1",
        staffName: "Rae Runner",
      }),
    ).rejects.toThrow(/evacuat/i);
  });

  it("resumes normal operations after evacuation", async () => {
    const db = getDb({ venueId: venueA });
    await resumeEvacuation(db, venueA, "staff-1", "Rae Runner");
    const state = await getEvacuationState(db, venueA);
    expect(state.state).toBe("normal");
  });

  // ── Zone occupancy ────────────────────────────────────────────────────

  it("reports zone-level occupancy", async () => {
    const db = getDb({ venueId: venueA });
    const occ = await getZoneOccupancy(db, "zone-a");
    expect(occ.current).toBeGreaterThanOrEqual(0);
  });

  it("checks zone capacity", async () => {
    const db = getDb({ venueId: venueA });
    // zone-a has no capacity set → unlimited → any party size allowed
    const unlimited = await checkZoneCapacity(db, "zone-a", 10_000);
    expect(unlimited.allowed).toBe(true);

    // zone-b has capacity 50 set via seed — 60 should be blocked
    await prisma.zone.update({ where: { id: "zone-b" }, data: { capacity: 50 } });
    const over = await checkZoneCapacity(db, "zone-b", 60);
    expect(over.allowed).toBe(false);
  });

  // ── Refusals ──────────────────────────────────────────────────────────

  it("records and lists door refusals", async () => {
    const db = getDb({ venueId: venueA });
    await recordRefusal(db, venueA, {
      reason: "dress code",
      description: "Guest wearing shorts on formal night",
      partySize: 2,
      staffId: "staff-1",
      staffName: "Rae Runner",
    });

    const refusals = await listRefusals(db, venueA);
    expect(refusals.some((r) => r.reason === "dress code")).toBe(true);
  });
});
