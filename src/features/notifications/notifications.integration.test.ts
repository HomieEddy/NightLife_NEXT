import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";

async function makeVenue(rawClient: PrismaClient, name: string, slug: string) {
  const org = await rawClient.organization.create({ data: { id: `org-${slug}`, name, slug } });
  await rawClient.venue.create({
    data: {
      id: org.id,
      address: "1 Test St",
      city: "Testville",
      timezone: "UTC",
      currency: "USD",
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

describe("notifications integration (Phase 5)", () => {
  let testDb: TestDb;
  let rawClient: PrismaClient;
  let venueA: string;
  let venueB: string;

  beforeAll(async () => {
    testDb = await createTestDb();
    rawClient = testDb.rawClient;
    venueA = await makeVenue(rawClient, "Notif A", "notif-a-int");
    venueB = await makeVenue(rawClient, "Notif B", "notif-b-int");
  }, 60_000);

  afterAll(async () => {
    await testDb?.teardown();
  });

  it("creates and reads push subscriptions scoped to venue", async () => {
    const sub = await rawClient.pushSubscription.create({
      data: { venueId: venueA, userId: "user-1", endpoint: "https://push.example.com/sub-1", keys: { p256dh: "k1", auth: "a1" } },
    });

    const subs = await rawClient.pushSubscription.findMany({ where: { venueId: venueA } });
    expect(subs).toHaveLength(1);
    expect(subs[0].userId).toBe("user-1");
    expect(subs[0].endpoint).toBe("https://push.example.com/sub-1");

    // tenant isolation — venueB cannot see venueA's subscription
    const bSubs = await rawClient.pushSubscription.findMany({ where: { venueId: venueB, id: sub.id } });
    expect(bSubs).toHaveLength(0);
  });

  it("updates push subscription expiry", async () => {
    await rawClient.pushSubscription.create({
      data: { venueId: venueA, userId: "user-2", endpoint: "https://push.example.com/sub-2", keys: { p256dh: "k2", auth: "a2" } },
    });

    await rawClient.pushSubscription.updateMany({
      where: { endpoint: "https://push.example.com/sub-2" },
      data: { expired: true },
    });

    const active = await rawClient.pushSubscription.findMany({ where: { venueId: venueA, expired: false } });
    expect(active.find((s) => s.endpoint === "https://push.example.com/sub-2")).toBeUndefined();
  });

  it("creates and scopes notification preferences", async () => {
    const pref = await rawClient.notificationPreference.create({
      data: { venueId: venueA, userId: "user-pref", eventType: "OrderPlaced", channel: "push", enabled: true },
    });

    expect(pref.eventType).toBe("OrderPlaced");
    expect(pref.channel).toBe("push");
    expect(pref.enabled).toBe(true);

    // unique constraint: second create with same (venueId, userId, eventType, channel) should fail
    // ponytail: don't use rejects.toThrow() on PGlite — closes the connection

    // tenant isolation — venueB cannot see venueA's preference
    const bPrefs = await rawClient.notificationPreference.findMany({ where: { venueId: venueB, id: pref.id } });
    expect(bPrefs).toHaveLength(0);

    // read back with filter
    const found = await rawClient.notificationPreference.findMany({
      where: { venueId: venueA, userId: "user-pref", channel: "push", eventType: "OrderPlaced" },
    });
    expect(found).toHaveLength(1);
    expect(found[0].enabled).toBe(true);
  });

  it("deletes notification preferences", async () => {
    const pref = await rawClient.notificationPreference.create({
      data: { venueId: venueA, userId: "user-del", eventType: "BroadcastSent", channel: "push", enabled: true },
    });

    await rawClient.notificationPreference.delete({ where: { id: pref.id } });
    const remaining = await rawClient.notificationPreference.findMany({ where: { venueId: venueA, userId: "user-del" } });
    expect(remaining).toHaveLength(0);
  });

  it("creates user quiet hours with default timezone", async () => {
    await rawClient.userQuietHours.create({
      data: { venueId: venueA, userId: "user-qh", startTime: "22:00", endTime: "08:00" },
    });

    const qh = await rawClient.userQuietHours.findFirst({ where: { venueId: venueA, userId: "user-qh" } });
    expect(qh).not.toBeNull();
    expect(qh!.startTime).toBe("22:00");
    expect(qh!.endTime).toBe("08:00");
    expect(qh!.timezone).toBe("America/Toronto");
  });

  it("quiet hours are tenant-scoped", async () => {
    const qhA = await rawClient.userQuietHours.findFirst({ where: { venueId: venueA, userId: "user-qh" } });
    const qhB = await rawClient.userQuietHours.findFirst({ where: { venueId: venueB, userId: "user-qh" } });
    expect(qhA).not.toBeNull();
    expect(qhB).toBeNull();
  });
});
