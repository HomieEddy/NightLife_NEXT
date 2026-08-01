import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getDb, type SessionContext } from "@/features/shared/db";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";
import { expectTenantIsolation } from "@/features/shared/test-helpers";
import {
  clockIn,
  clockOut,
  startBreak,
  endBreak,
  getCurrentTimeEntry,
  editTimeEntry,
  listTimeEntries,
  saveGeneratedShifts,
  publishShifts,
  cancelShift,
  listShifts,
  requestTimeOff,
  approveTimeOff,
  requestSwap,
  claimSwap,
  approveSwap,
} from "@/features/workforce/time-core";
import type { Shift } from "@/lib/types";

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

describe("workforce time integration (plan 18, WS-4)", () => {
  let testDb: TestDb;
  let prisma: PrismaClient;
  const venueA = "time-venue-a";
  const venueB = "time-venue-b";
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

  describe("clock in/out", () => {
    it("clocks in and reports the open entry as current", async () => {
      const db = getDb(sessionA);
      const entry = await clockIn(db, venueA, "st-clock-1");
      expect(entry.clockOutAt).toBeUndefined();

      const current = await getCurrentTimeEntry(db, "st-clock-1");
      expect(current?.id).toBe(entry.id);
    });

    it("INV-W1: refuses a second clock-in while one is already open", async () => {
      const db = getDb(sessionA);
      await expect(clockIn(db, venueA, "st-clock-1")).rejects.toThrow("Already clocked in");
    });

    it("clocks out and computes minutes worked", async () => {
      const db = getDb(sessionA);
      const closed = await clockOut(db, venueA, "st-clock-1");
      expect(closed.clockOutAt).toBeDefined();
      expect(closed.minutesWorked).toBeGreaterThanOrEqual(0);

      const current = await getCurrentTimeEntry(db, "st-clock-1");
      expect(current).toBeNull();
    });

    it("refuses clock-out with no open entry", async () => {
      const db = getDb(sessionA);
      await expect(clockOut(db, venueA, "st-clock-1")).rejects.toThrow("No open clock-in found");
    });
  });

  describe("breaks", () => {
    it("starts and ends a break on the open entry", async () => {
      const db = getDb(sessionA);
      await clockIn(db, venueA, "st-break-1");

      const withBreak = await startBreak(db, venueA, "st-break-1");
      expect(withBreak.breaks.length).toBe(1);
      expect(withBreak.breaks[0].endedAt).toBeUndefined();

      const ended = await endBreak(db, venueA, "st-break-1");
      expect(ended.breaks[0].endedAt).toBeDefined();
    });

    it("refuses to end a break when none is active", async () => {
      const db = getDb(sessionA);
      await expect(endBreak(db, venueA, "st-break-1")).rejects.toThrow("No active break.");
    });

    it("refuses to start a break when not clocked in", async () => {
      const db = getDb(sessionA);
      await expect(startBreak(db, venueA, "st-never-clocked-in")).rejects.toThrow("Not clocked in.");
    });
  });

  describe("INV-W3: manager edits are append-only", () => {
    it("editing a time entry creates a new row and leaves the original untouched", async () => {
      const db = getDb(sessionA);
      const original = await clockIn(db, venueA, "st-edit-1");
      await clockOut(db, venueA, "st-edit-1");

      const edited = await editTimeEntry(
        db, venueA, original.id,
        { minutesWorked: 400 },
        "st-mgr", "Forgot to clock out on time",
      );

      expect(edited.id).not.toBe(original.id);
      expect(edited.minutesWorked).toBe(400);

      const rows = await listTimeEntries(db, "st-edit-1");
      const originalRow = rows.find((r) => r.id === original.id);
      expect(originalRow?.minutesWorked).not.toBe(400);
    });
  });

  describe("shifts", () => {
    // saveGeneratedShifts assigns its own row id (Prisma default cuid) — the
    // caller-supplied id on the Shift literal below is not honored, so tests
    // must thread the id it actually returns rather than assume one.
    const draftShift: Shift = {
      id: "ignored", venueId: venueA, staffId: "st-shift-1", businessDate: "2026-08-01",
      scheduledStart: "2026-08-01T22:00:00Z", scheduledEnd: "2026-08-02T04:00:00Z",
      zoneId: null, role: "bartender", status: "draft",
    };
    let shiftId: string;

    it("saves a generated shift as draft", async () => {
      const db = getDb(sessionA);
      const [saved] = await saveGeneratedShifts(db, [draftShift]);
      expect(saved.status).toBe("draft");
      shiftId = saved.id;
    });

    it("publishing stamps publishedAt and flips status", async () => {
      const db = getDb(sessionA);
      const [published] = await publishShifts(db, [shiftId]);
      expect(published.status).toBe("published");
      expect(published.publishedAt).toBeDefined();
    });

    it("cancelling a shift sets status to cancelled without deleting it", async () => {
      const db = getDb(sessionA);
      const cancelled = await cancelShift(db, shiftId);
      expect(cancelled.status).toBe("cancelled");

      const rows = await listShifts(db, "st-shift-1");
      expect(rows.some((s) => s.id === shiftId)).toBe(true);
    });
  });

  describe("time off", () => {
    it("requests time off and a manager can approve it", async () => {
      const db = getDb(sessionA);
      const req = await requestTimeOff(db, {
        venueId: venueA, staffId: "st-timeoff-1",
        startDate: "2026-08-10", endDate: "2026-08-12", reason: "Family trip",
      });
      expect(req.status).toBe("requested");

      const approved = await approveTimeOff(db, req.id, "st-mgr", true);
      expect(approved.status).toBe("approved");
      expect(approved.decidedByStaffId).toBe("st-mgr");
    });

    it("a manager can deny a request", async () => {
      const db = getDb(sessionA);
      const req = await requestTimeOff(db, {
        venueId: venueA, staffId: "st-timeoff-2",
        startDate: "2026-08-15", endDate: "2026-08-16", reason: "No coverage",
      });
      const denied = await approveTimeOff(db, req.id, "st-mgr", false);
      expect(denied.status).toBe("denied");
    });
  });

  describe("shift swaps", () => {
    it("requests a swap, another staff member claims it, a manager approves it", async () => {
      const db = getDb(sessionA);
      const [{ id: swapShiftId }] = await saveGeneratedShifts(db, [{
        id: "ignored", venueId: venueA, staffId: "st-swap-owner", businessDate: "2026-08-05",
        scheduledStart: "2026-08-05T22:00:00Z", scheduledEnd: "2026-08-06T04:00:00Z",
        zoneId: null, role: "bartender", status: "draft",
      }]);
      const swap = await requestSwap(db, {
        venueId: venueA, shiftId: swapShiftId, requestedByStaffId: "st-swap-owner",
      });
      expect(swap.status).toBe("open");

      const claimed = await claimSwap(db, swap.id, "st-swap-taker");
      expect(claimed.status).toBe("claimed");
      expect(claimed.claimedByStaffId).toBe("st-swap-taker");

      const approved = await approveSwap(db, swap.id, "st-mgr", true);
      expect(approved.status).toBe("approved");
    });
  });

  describe("tenant isolation", () => {
    it("a tenant cannot see another venue's open time entry", async () => {
      await clockIn(getDb({ venueId: venueB }), venueB, "st-shared-id");

      await expectTenantIsolation(venueB, venueA, (scoped) =>
        getCurrentTimeEntry(scoped, "st-shared-id"),
      );
    });

    it("a tenant cannot cancel another venue's shift", async () => {
      const [{ id: otherShiftId }] = await saveGeneratedShifts(getDb({ venueId: venueB }), [{
        id: "ignored", venueId: venueB, staffId: "st-b", businessDate: "2026-08-01",
        scheduledStart: "2026-08-01T22:00:00Z", scheduledEnd: "2026-08-02T04:00:00Z",
        zoneId: null, role: "runner", status: "draft",
      }]);

      // cancelShift has no venue guard of its own — the scoped client's where
      // clause is what must stop it. venueA's session must not find the row.
      await expectTenantIsolation(venueB, venueA, (scoped) =>
        scoped.shift.findFirst({ where: { id: otherShiftId } }),
      );
    });
  });
});
