import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getDb, type SessionContext } from "@/features/shared/db";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";
import {
  listBroadcasts,
  sendBroadcast,
  getLastCallState,
  startLastCall,
  endLastCall,
  getActiveShow,
  startShow,
  finishShow,
  listMessages,
  sendMessage,
} from "@/features/realtime/floor-core";
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
      slaThresholds: { orderWarnMinutes: 6, orderCriticalMinutes: 12, helpWarnMinutes: 4, helpCriticalMinutes: 8 },
      lastCallAutoFlagTables: true,
    },
  });
  return org.id;
}

describe("floor-core integration (plan 07)", () => {
  let testDb: TestDb;
  let rawClient: PrismaClient;
  let venueA: string;
  let venueB: string;
  let ctxA: SessionContext;

  beforeAll(async () => {
    testDb = await createTestDb();
    rawClient = testDb.rawClient;

    venueA = await makeVenue(rawClient, "Club A", "club-a");
    venueB = await makeVenue(rawClient, "Club B", "club-b");
    ctxA = { venueId: venueA };
  }, 60_000);

  afterAll(async () => {
    await testDb?.teardown();
  });

  // ── Broadcasts ────────────────────────────────────────────────────

  it("sends and lists broadcasts", async () => {
    const db = getDb(ctxA);
    const bc = await sendBroadcast(db, venueA, "All hands on deck!", "DJ Max");
    expect(bc.message).toBe("All hands on deck!");
    expect(bc.sentBy).toBe("DJ Max");

    const list = await listBroadcasts(db);
    expect(list[0].id).toBe(bc.id);
  });

  it("broadcast cross-posts to all chat channels", async () => {
    const db = getDb(ctxA);
    for (const channel of ["floor", "bar", "security"] as const) {
      const msgs = await listMessages(db, channel);
      expect(msgs.some((m) => m.body.includes("All hands on deck!"))).toBe(true);
    }
  });

  it("enforces tenant isolation for broadcasts", async () => {
    const db = getDb(ctxA);
    const bc = await sendBroadcast(db, venueA, "Only for A", "Manager A");
    await expectTenantIsolation(venueA, venueB, (scopedDb) =>
      scopedDb.broadcast.findUnique({ where: { id: bc.id } }),
    );
  });

  // ── Last call ─────────────────────────────────────────────────────

  it("starts and ends last call", async () => {
    const db = getDb(ctxA);

    const before = await getLastCallState(db, venueA);
    expect(before.active).toBe(false);

    await startLastCall(db, venueA, "Manager");
    const during = await getLastCallState(db, venueA);
    expect(during.active).toBe(true);
    expect(during.startedAt).not.toBeNull();

    await endLastCall(db, venueA);
    const after = await getLastCallState(db, venueA);
    expect(after.active).toBe(false);
    expect(after.startedAt).toBeNull();
  });

  // ── Show lock (INV-F1) ────────────────────────────────────────────

  it("allows one show and blocks concurrent start", async () => {
    const db = getDb(ctxA);
    const first = await startShow(venueA, "order-1", "VIP-01", "Skybar", "Sparkler parade", "Alice");
    expect(first.ok).toBe(true);
    expect(first.activeShow?.orderId).toBe("order-1");

    const second = await startShow(venueA, "order-2", "BAR-01", "Bar", "LED sign", "Bob");
    expect(second.ok).toBe(false);
    expect(second.activeShow?.orderId).toBe("order-1");

    const current = await getActiveShow(db);
    expect(current?.orderId).toBe("order-1");

    await finishShow(venueA);
    const cleared = await getActiveShow(db);
    expect(cleared).toBeNull();
  });

  it("concurrent startShow yields exactly one winner", async () => {
    const results = await Promise.all([
      startShow(venueA, "race-1", "VIP-01", "Skybar", "Sparkler", "Alice"),
      startShow(venueA, "race-2", "BAR-01", "Bar", "LED", "Bob"),
      startShow(venueA, "race-3", "LOUNGE-01", "Lounge", "Confetti", "Charlie"),
    ]);

    const winners = results.filter((r) => r.ok);
    expect(winners.length).toBe(1);

    await finishShow(venueA);
  });

  // ── Chat messages ─────────────────────────────────────────────────

  it("sends and lists chat messages by channel", async () => {
    const db = getDb(ctxA);
    await sendMessage(db, venueA, {
      channel: "bar",
      authorId: "staff-1",
      authorName: "Alice",
      authorRole: "bartender",
      body: "Running low on ice",
    });

    const barMsgs = await listMessages(db, "bar");
    expect(barMsgs.some((m) => m.body === "Running low on ice")).toBe(true);

    const floorMsgs = await listMessages(db, "floor");
    expect(floorMsgs.some((m) => m.body === "Running low on ice")).toBe(false);
  });

  it("enforces tenant isolation for chat messages", async () => {
    const db = getDb(ctxA);
    const msg = await sendMessage(db, venueA, {
      channel: "security",
      authorId: "staff-1",
      authorName: "Guard",
      authorRole: "security",
      body: "All clear",
    });

    await expectTenantIsolation(venueA, venueB, (scopedDb) =>
      scopedDb.chatMessage.findUnique({ where: { id: msg.id } }),
    );
  });
});
