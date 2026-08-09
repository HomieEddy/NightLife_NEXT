import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getDb, type SessionContext } from "@/features/shared/db";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";
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
} from "@/features/ordering/core";
import { createCategory, createItem, createPackage, checkLedger, getItem } from "@/features/menu/core";
import { expectTenantIsolation } from "@/features/shared/test-helpers";
import { toCents } from "@/features/shared/money";

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

  it("resolves authoritative add-ons and decrements washer quantity independently", async () => {
    const db = getDb(sessionA);
    const washerCategory = await createCategory(db, venueA, {
      name: "Washers",
      description: "",
      sortOrder: 30,
    });
    const washer = await createItem(db, venueA, {
      categoryId: washerCategory.id,
      name: "Red Bull",
      description: "",
      priceCents: 600,
      icon: "washer",
      tags: [],
      inventory: 10,
    });
    const bottleCategory = await createCategory(db, venueA, {
      name: "Add-on bottles",
      description: "",
      sortOrder: 31,
      modifierGroups: [{
        id: "washers",
        name: "Washers",
        kind: "washer",
        required: true,
        maxSelections: 1,
        isActive: true,
        options: [{
          id: "red-bull",
          name: "Red Bull",
          priceDelta: 6,
          maxQuantity: 4,
          inventoryItemId: washer.id,
          isActive: true,
        }],
      }],
    });
    const bottle = await createItem(db, venueA, {
      categoryId: bottleCategory.id,
      name: "Test bottle",
      description: "",
      priceCents: 20_000,
      icon: "vodka",
      tags: [],
      inventory: 5,
    });

    const result = await submitOrder(db, venueA, {
      tableId: "t1",
      tableCode: "VIP-01",
      zoneId: "z1",
      zoneName: "VIP",
      guestName: "Add-on guest",
      lines: [{
        menuItemId: bottle.id,
        quantity: 2,
        modifiers: [{ groupId: "washers", optionId: "red-bull", quantity: 3 }],
      }],
      tipCents: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.subtotal).toBe(418);
    expect(result.order.items[0].modifiers).toEqual([expect.objectContaining({
      kind: "washer",
      optionName: "Red Bull",
      priceDelta: 6,
      quantity: 3,
    })]);
    expect((await getItem(db, bottle.id))?.inventory).toBe(3);
    expect((await getItem(db, washer.id))?.inventory).toBe(7);
  });

  it("rejects invalid add-on selections without drawing inventory", async () => {
    const db = getDb(sessionA);
    const washerCategory = await createCategory(db, venueA, {
      name: "Validation washers", description: "", sortOrder: 32,
    });
    const washer = await createItem(db, venueA, {
      categoryId: washerCategory.id, name: "Rare washer", description: "",
      priceCents: 500, icon: "washer", tags: [], inventory: 1,
    });
    const bottleCategory = await createCategory(db, venueA, {
      name: "Validation bottles", description: "", sortOrder: 33,
      modifierGroups: [{
        id: "required-washers", name: "Washers", kind: "washer", required: true,
        maxSelections: 1, isActive: true,
        options: [{
          id: "rare", name: "Rare washer", priceDelta: 5, maxQuantity: 2,
          inventoryItemId: washer.id, isActive: true,
        }],
      }],
    });
    const bottle = await createItem(db, venueA, {
      categoryId: bottleCategory.id, name: "Validation bottle", description: "",
      priceCents: 10_000, icon: "vodka", tags: [], inventory: 4,
    });
    const submit = (modifiers: { groupId: string; optionId: string; quantity: number }[]) =>
      submitOrder(db, venueA, {
        tableId: "t1", tableCode: "VIP-01", zoneId: "z1", zoneName: "VIP",
        guestName: "Validation", lines: [{ menuItemId: bottle.id, quantity: 1, modifiers }],
        tipCents: 0,
      });

    expect((await submit([])).ok).toBe(false);
    expect((await submit([{ groupId: "required-washers", optionId: "forged", quantity: 1 }])).ok).toBe(false);
    expect((await submit([
      { groupId: "required-washers", optionId: "rare", quantity: 1 },
      { groupId: "required-washers", optionId: "rare", quantity: 1 },
    ])).ok).toBe(false);
    expect((await submit([{ groupId: "required-washers", optionId: "rare", quantity: 3 }])).ok).toBe(false);
    expect((await submit([{ groupId: "required-washers", optionId: "rare", quantity: 2 }])).ok).toBe(false);

    expect((await getItem(db, bottle.id))?.inventory).toBe(4);
    expect((await getItem(db, washer.id))?.inventory).toBe(1);
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

  it("rolls back package and washer draw-downs together", async () => {
    const db = getDb(sessionA);
    const cat = await createCategory(db, venueA, {
      name: "Rollback Package Items",
      description: "",
      sortOrder: 34,
    });
    const bottle = await createItem(db, venueA, {
      categoryId: cat.id,
      name: "Rollback Bottle",
      description: "",
      priceCents: 20000,
      icon: "vodka",
      tags: [],
      inventory: 5,
    });
    const washer = await createItem(db, venueA, {
      categoryId: cat.id,
      name: "Rollback Washer",
      description: "",
      priceCents: 600,
      icon: "washer",
      tags: [],
      inventory: 1,
    });
    const pkg = await createPackage(db, venueA, {
      name: "Rollback Package",
      description: "",
      priceCents: 35000,
      components: [{ menuItemId: bottle.id, quantity: 1 }],
      modifierGroups: [{
        id: "washers",
        name: "Washers",
        kind: "washer",
        required: true,
        maxSelections: 1,
        isActive: true,
        options: [{
          id: "rollback-washer",
          name: "Rollback Washer",
          priceDelta: 6,
          maxQuantity: 2,
          inventoryItemId: washer.id,
          isActive: true,
        }],
      }],
    });

    const result = await submitOrder(db, venueA, {
      tableId: "t1",
      tableCode: "VIP-01",
      zoneId: "z1",
      zoneName: "VIP",
      guestName: "Rollback proof",
      lines: [{
        menuItemId: pkg.id,
        quantity: 2,
        modifiers: [{ groupId: "washers", optionId: "rollback-washer", quantity: 2 }],
      }],
      tipCents: 0,
    });

    expect(result.ok).toBe(false);
    expect((await getItem(db, bottle.id))?.inventory).toBe(5);
    expect((await getItem(db, washer.id))?.inventory).toBe(1);
    expect(await rawClient.order.count({ where: { guestName: "Rollback proof" } })).toBe(0);
    expect((await checkLedger(db, bottle.id)).balanced).toBe(true);
    expect((await checkLedger(db, washer.id)).balanced).toBe(true);
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

  it("cancels from non-terminal status and returns the draw-down to stock", async () => {
    const db = getDb(sessionA);
    const before = (await getItem(db, itemId))!.inventory;
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
    expect((await getItem(db, itemId))!.inventory).toBe(before - 1);

    const cancelled = await cancelOrder(db, result.order.id);
    expect(cancelled!.status).toBe("cancelled");

    expect((await getItem(db, itemId))!.inventory).toBe(before);
    const ledger = await checkLedger(db, itemId);
    expect(ledger.balanced).toBe(true);
  });

  it("does not reverse stock twice when cancel is called again", async () => {
    const db = getDb(sessionA);
    const before = (await getItem(db, itemId))!.inventory;
    const result = await submitOrder(db, venueA, {
      tableId: "t1",
      tableCode: "VIP-01",
      zoneId: "z1",
      zoneName: "VIP",
      guestName: "Fred",
      lines: [{ menuItemId: itemId, quantity: 2, modifiers: [] }],
      tipCents: 0,
    });
    if (!result.ok) return;

    await cancelOrder(db, result.order.id);
    await cancelOrder(db, result.order.id);
    expect((await getItem(db, itemId))!.inventory).toBe(before);
  });

  // ── Closure ordering wall ───────────────────────────────────────────

  async function makeSession(status: "approved" | "closure_requested" | "closed") {
    const row = await rawClient.guestSession.create({
      data: {
        venueId: venueA,
        tableId: "t1",
        tableCode: "VIP-01",
        zoneName: "VIP",
        displayName: "Wall Tester",
        partySize: 2,
        status,
      },
    });
    return row.id;
  }

  it("accepts an order on an approved session", async () => {
    const db = getDb(sessionA);
    const result = await submitOrder(db, venueA, {
      tableId: "t1",
      tableCode: "VIP-01",
      zoneId: "z1",
      zoneName: "VIP",
      guestName: "Wall Tester",
      sessionId: await makeSession("approved"),
      lines: [{ menuItemId: itemId, quantity: 1, modifiers: [] }],
      tipCents: 0,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects an order once the session's closure is requested", async () => {
    const db = getDb(sessionA);
    const before = (await getItem(db, itemId))!.inventory;
    const result = await submitOrder(db, venueA, {
      tableId: "t1",
      tableCode: "VIP-01",
      zoneId: "z1",
      zoneName: "VIP",
      guestName: "Wall Tester",
      sessionId: await makeSession("closure_requested"),
      lines: [{ menuItemId: itemId, quantity: 1, modifiers: [] }],
      tipCents: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/being closed/);
    expect((await getItem(db, itemId))!.inventory).toBe(before);
  });

  it("rejects an order on a closed session", async () => {
    const db = getDb(sessionA);
    const result = await submitOrder(db, venueA, {
      tableId: "t1",
      tableCode: "VIP-01",
      zoneId: "z1",
      zoneName: "VIP",
      guestName: "Wall Tester",
      sessionId: await makeSession("closed"),
      lines: [{ menuItemId: itemId, quantity: 1, modifiers: [] }],
      tipCents: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/closed/);
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

  // ── Concurrency guards (regression) ────────────────────────────────

  it("venue_counters mints distinct sequential codes under concurrent submission", async () => {
    const db = getDb(sessionA);
    // Dedicated high-stock item so the race is about codes, not inventory.
    const raceItem = await createItem(db, venueA, {
      categoryId: catId,
      name: "Race Bottle",
      description: "",
      priceCents: toCents(100),
      icon: "champagne",
      tags: [],
      inventory: 200,
    });
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        submitOrder(db, venueA, {
          tableId: "t1",
          tableCode: "VIP-01",
          zoneId: "z1",
          zoneName: "VIP",
          guestName: `Race ${i}`,
          lines: [{ menuItemId: raceItem.id, quantity: 1, modifiers: [] }],
          tipCents: 0,
        }),
      ),
    );
    const codes = results.map((r) => (r.ok ? r.order.code : `FAILED-${(r as { error?: string }).error}`));
    expect(new Set(codes).size).toBe(20);
    // Sequential (no gaps possible without drops — codes are a monotonic counter).
    const seq = codes.map((c) => Number(c.slice(2)));
    expect(Math.max(...seq) - Math.min(...seq)).toBe(19);
  });

  it("advanceOrder CAS — a double-advance cannot skip a state", async () => {
    const db = getDb(sessionA);
    const result = await submitOrder(db, venueA, {
      tableId: "t1",
      tableCode: "VIP-01",
      zoneId: "z1",
      zoneName: "VIP",
      guestName: "CAS",
      lines: [{ menuItemId: itemId, quantity: 1, modifiers: [] }],
      tipCents: 0,
    });
    if (!result.ok) return;

    await Promise.all([
      advanceOrder(db, result.order.id),
      advanceOrder(db, result.order.id),
    ]);

    // Exactly one advance won: the order sits at "accepted", not "preparing".
    const after = await getOrder(db, result.order.id);
    expect(after?.status).toBe("accepted");
  });
});
