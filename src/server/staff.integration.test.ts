import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./test-pglite";
import { getCurrentStaff, listStaff, removeStaff, toggleShift, updateStaff } from "./staff-core";
import { expectTenantIsolation } from "./test-helpers";

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

describe("staff identity integration", () => {
  let testDb: TestDb;
  let prisma: PrismaClient;
  const venueA = "staff-venue-a";
  const venueB = "staff-venue-b";
  const userId = "staff-user-a";

  beforeAll(async () => {
    testDb = await createTestDb();
    prisma = testDb.rawClient;
    await makeVenue(prisma, venueA);
    await makeVenue(prisma, venueB);
    await prisma.user.create({ data: { id: userId, name: "Rae Runner", email: "rae@test.local" } });
    await prisma.member.create({ data: { id: "member-a", userId, organizationId: venueA, role: "member" } });
    await prisma.staffProfile.create({
      data: { userId, role: "runner", phone: "555", avatarInitials: "RR" },
    });
  }, 60_000);

  afterAll(async () => testDb?.teardown());

  it("resolves current staff from the authenticated user and updates exact role", async () => {
    expect((await getCurrentStaff(prisma, venueA, userId))?.name).toBe("Rae Runner");
    expect(await getCurrentStaff(prisma, venueB, userId)).toBeNull();

    const updated = await updateStaff(prisma, venueA, userId, {
      name: "Rae Manager", role: "manager", accountStatus: "suspended",
    });
    expect(updated).toEqual(expect.objectContaining({
      name: "Rae Manager", role: "manager", accountStatus: "suspended",
    }));
    expect((await prisma.member.findUnique({ where: { id: "member-a" } }))?.role).toBe("admin");
  });

  it("lists only venue members and toggles shift state", async () => {
    const list = await listStaff(prisma, venueA);
    expect(list.map((staff) => staff.id)).toContain(userId);
    expect((await listStaff(prisma, venueB)).map((staff) => staff.id)).not.toContain(userId);
    expect((await toggleShift(prisma, venueA, userId))?.isOnShift).toBe(true);

    const shift = await prisma.staffShift.create({
      data: { venueId: venueA, staffId: userId, dayOfWeek: 5, startTime: "20:00", endTime: "04:00" },
    });
    await expectTenantIsolation(venueA, venueB, (db) =>
      db.staffShift.findUnique({ where: { id: shift.id } }),
    );
  });

  it("removing staff clears venue shifts and membership", async () => {
    expect(await removeStaff(prisma, venueA, userId)).toBe(true);
    expect(await prisma.staffShift.count({ where: { staffId: userId } })).toBe(0);
    expect(await prisma.member.count({ where: { userId, organizationId: venueA } })).toBe(0);
  });
});
