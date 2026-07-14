import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getDb, type SessionContext } from "./db";
import { createTestDb, type TestDb } from "./test-pglite";
import {
  submitOrder,
  getOrder,
  listOrders,
  advanceOrder,
  cancelOrder,
  claimOrder,
  releaseOrder,
  sendGift,
  nextStatus,
} from "./order-core";
import { createCategory, createItem, checkLedger, getItem } from "./menu-core";
import { expectTenantIsolation } from "./test-helpers";
import { toCents } from "./money";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function makeVenue(rawClient: PrismaClient, name: string, slug: string, serviceFees: any = []) {
  const org = await rawClient.organization.create({ data: { id: `org-${slug}`, name, slug } });
  await rawClient.venue.create({
    data: {
      id: org.id,
      address: "1 Test St",
      city: "Testville",
      timezone: "America/Montreal",
      currency: "CAD",
      openingHours: [],
      serviceFees,
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

describe("orders & fees integration (plan 05)", () => {
  let testDb: TestDb;
  let rawClient: PrismaClient;
  let venueA: string;
  let venueB: string;
  let sessionA: SessionContext;
  let catId: string;
  let itemId: string;

  beforeAll(async () => {
    testDb = await createTestDb();
    rawClient = testDb.rawClient;

    venueA = await makeVenue(rawClient, "Order Venue A", "order-a-int", [
      { id: "svc", name: "Service", type: "percentage", value: 5 },
    ]);
    venueB = await makeVenue(rawClient, "Order Venue B", "order-b-int");
    sessionA = { venueId: venueA };

    // Seed a category + item for order tests
    const db = getDb(sessionA);
    const cat = await createCategory(db, venueA, {
      name: "Champagne",
      description: "",
      sortOrder: 1,
    });
    catId = cat.id;
    const item = await createItem(db, venueA, {
      categoryId: catId,
      name: "Ace of Spades",
      description: "",
      priceCents: toCents(500),
      icon: "champagne",
      tags: [],
      inventory: 20,
    });
    itemId = item.id;
  }, 60_000);

  afterAll(async () => {
    await testDb?.teardown();
  });

  // ── Submit order (success path) ─────────────────────────────────────

  it("creates order + items + fee lines + stock movements atomically", async () => {
    const db = getDb(sessionA);
    const result = await submitOrder(db, venueA, {
      tableId: "t1",
      tableCode: "VIP-01",
      zoneId: "z1",
      zoneName: "VIP",
      guestName: "Alice",
      lines: [{ menuItemId: itemId, quantity: 2, modifiers: [] }],
      tipCents: 500,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const order = result.order;
    expect(order.status).toBe("pending");
    expect(order.items).toHaveLength(1);
    expect(order.items[0].quantity).toBe(2);
    expect(order.subtotal).toBe(1000); // 500 * 2
    expect(order.feeBreakdown).toBeDefined();
    expect(order.feeBreakdown!.length).toBeGreaterThan(0);
    expect(order.tip).toBe(5);
    expect(order.total).toBe(order.subtotal + order.serviceFee + order.tip);

    // Verify inventory decremented
    const item = await getItem(db, itemId);
    expect(item!.inventory).toBe(18); // 20 - 2

    // Verify ledger balanced
    const ledger = await checkLedger(db, itemId);
    expect(ledger.balanced).toBe(true);
  });

  // ── Inventory failure rolls back order ──────────────────────────────

  it("rolls back the entire order when inventory is insufficient", async () => {
    const db = getDb(sessionA);
    const cat = await createCategory(db, venueA, {
      name: "Scarce-Cat",
      description: "",
      sortOrder: 20,
    });
    const scarceItem = await createItem(db, venueA, {
      categoryId: cat.id,
      name: "Scarce Bottle",
      description: "",
      priceCents: toCents(100),
      icon: "champagne",
      tags: [],
      inventory: 1,
    });

    const result = await submitOrder(db, venueA, {
      tableId: "t1",
      tableCode: "VIP-01",
      zoneId: "z1",
      zoneName: "VIP",
      guestName: "Bob",
      lines: [{ menuItemId: scarceItem.id, quantity: 5, modifiers: [] }],
      tipCents: 0,
    });

    expect(result.ok).toBe(false);

    // Inventory unchanged
    const after = await getItem(db, scarceItem.id);
    expect(after!.inventory).toBe(1);
  });

  // ── State machine ──────────────────────────────────────────────────

  it("advances through the order flow", async () => {
    const db = getDb(sessionA);
    const result = await submitOrder(db, venueA, {
      tableId: "t1",
      tableCode: "VIP-01",
      zoneId: "z1",
      zoneName: "VIP",
      guestName: "Charlie",
      lines: [{ menuItemId: itemId, quantity: 1, modifiers: [] }],
      tipCents: 0,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    let order = result.order;
    expect(order.status).toBe("pending");

    order = (await advanceOrder(db, order.id))!;
    expect(order.status).toBe("accepted");

    order = (await advanceOrder(db, order.id))!;
    expect(order.status).toBe("preparing");

    order = (await advanceOrder(db, order.id))!;
    expect(order.status).toBe("ready");

    order = (await advanceOrder(db, order.id))!;
    expect(order.status).toBe("delivered");

    // Already terminal — stays delivered
    const same = await advanceOrder(db, order.id);
    expect(same!.status).toBe("delivered");
  });

  it("rejects cancel from terminal status", async () => {
    const db = getDb(sessionA);
    const result = await submitOrder(db, venueA, {
      tableId: "t1",
      tableCode: "VIP-01",
      zoneId: "z1",
      zoneName: "VIP",
      guestName: "Denise",
      lines: [{ menuItemId: itemId, quantity: 1, modifiers: [] }],
      tipCents: 0,
    });
    if (!result.ok) return;

    // Advance to delivered
    let order = result.order;
    while (order.status !== "delivered") {
      order = (await advanceOrder(db, order.id))!;
    }

    // Cancel from delivered — stays delivered
    const cancelled = await cancelOrder(db, order.id);
    expect(cancelled!.status).toBe("delivered");
  });

  it("cancels from non-terminal status", async () => {
    const db = getDb(sessionA);
    const result = await submitOrder(db, venueA, {
      tableId: "t1",
      tableCode: "VIP-01",
      zoneId: "z1",
      zoneName: "VIP",
      guestName: "Eve",
      lines: [{ menuItemId: itemId, quantity: 1, modifiers: [] }],
      tipCents: 0,
    });
    if (!result.ok) return;

    const cancelled = await cancelOrder(db, result.order.id);
    expect(cancelled!.status).toBe("cancelled");
  });

  // ── Claims (atomic compare-and-set) ─────────────────────────────────

  it("exactly one staff wins a concurrent claim", async () => {
    const db = getDb(sessionA);
    const result = await submitOrder(db, venueA, {
      tableId: "t1",
      tableCode: "VIP-01",
      zoneId: "z1",
      zoneName: "VIP",
      guestName: "Frank",
      lines: [{ menuItemId: itemId, quantity: 1, modifiers: [] }],
      tipCents: 0,
    });
    if (!result.ok) return;

    const [r1, r2] = await Promise.all([
      claimOrder(db, venueA, result.order.id, "staff-1", "Alice Staff"),
      claimOrder(db, venueA, result.order.id, "staff-2", "Bob Staff"),
    ]);

    const successes = [r1, r2].filter((r) => r.ok).length;
    const failures = [r1, r2].filter((r) => !r.ok).length;
    expect(successes).toBe(1);
    expect(failures).toBe(1);

    const order = await getOrder(db, result.order.id);
    expect(order!.claimedByStaffId).toBeDefined();
  });

  it("release then re-claim works", async () => {
    const db = getDb(sessionA);
    const result = await submitOrder(db, venueA, {
      tableId: "t1",
      tableCode: "VIP-01",
      zoneId: "z1",
      zoneName: "VIP",
      guestName: "Grace",
      lines: [{ menuItemId: itemId, quantity: 1, modifiers: [] }],
      tipCents: 0,
    });
    if (!result.ok) return;

    await claimOrder(db, venueA, result.order.id, "staff-1", "Alice");
    await releaseOrder(db, result.order.id);

    const reclaim = await claimOrder(db, venueA, result.order.id, "staff-2", "Bob");
    expect(reclaim.ok).toBe(true);
    if (reclaim.ok) {
      expect(reclaim.order.claimedByStaffId).toBe("staff-2");
    }
  });

  // ── Gift billing ────────────────────────────────────────────────────

  it("sendGift creates an order with gift fields", async () => {
    const db = getDb(sessionA);
    const result = await sendGift(db, venueA, {
      fromTableId: "t1",
      fromTableCode: "VIP-01",
      fromZoneId: "z1",
      fromZoneName: "VIP",
      guestName: "Henry",
      menuItemId: itemId,
      toTableId: "t2",
      toTableCode: "VIP-02",
      note: "Enjoy!",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const order = result.order;
    expect(order.giftToTableId).toBe("t2");
    expect(order.giftToTableCode).toBe("VIP-02");
    expect(order.giftNote).toBe("Enjoy!");
    expect(order.items).toHaveLength(1);
    expect(order.items[0].quantity).toBe(1);
    expect(order.tip).toBe(0);
  });

  // ── List + filter ───────────────────────────────────────────────────

  it("listOrders filters by status", async () => {
    const db = getDb(sessionA);
    const pending = await listOrders(db, { status: ["pending"] });
    for (const o of pending) {
      expect(o.status).toBe("pending");
    }
  });

  // ── nextStatus helper ───────────────────────────────────────────────

  it("nextStatus returns correct transitions", () => {
    expect(nextStatus("pending")).toBe("accepted");
    expect(nextStatus("accepted")).toBe("preparing");
    expect(nextStatus("preparing")).toBe("ready");
    expect(nextStatus("ready")).toBe("delivered");
    expect(nextStatus("delivered")).toBeNull();
    expect(nextStatus("cancelled")).toBeNull();
  });

  // ── Tenant isolation ────────────────────────────────────────────────

  it("never leaks orders across venues (AD-3 canary)", async () => {
    const db = getDb(sessionA);

    // Ensure venue A has at least one order
    const result = await submitOrder(db, venueA, {
      tableId: "t1",
      tableCode: "VIP-01",
      zoneId: "z1",
      zoneName: "VIP",
      guestName: "Isolation",
      lines: [{ menuItemId: itemId, quantity: 1, modifiers: [] }],
      tipCents: 0,
    });
    if (!result.ok) return;

    await expectTenantIsolation(venueA, venueB, (scopedDb) =>
      scopedDb.order.findUnique({ where: { id: result.order.id } }),
    );
  });
});
