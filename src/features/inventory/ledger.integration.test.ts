import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getDb, getRawPrisma } from "@/features/shared/db";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";
import { applyMovement, transition } from "@/features/inventory/ledger";
import { checkLedger, createCategory, createItem, getItem } from "@/features/menu/core";
import { expectTenantIsolation } from "@/features/shared/test-helpers";

describe("inventory ledger — lock, move, invariant (INV)", () => {
  let testDb: TestDb;
  let rawClient: PrismaClient;
  let venueA: string;
  let venueB: string;
  let itemId: string;

  beforeAll(async () => {
    testDb = await createTestDb();
    rawClient = testDb.rawClient;

    const makeVenue = async (name: string, slug: string) => {
      const org = await rawClient.organization.create({ data: { id: `org-${slug}`, name, slug } });
      await rawClient.venue.create({
        data: {
          id: org.id,
          address: "1 Ledger St",
          city: "Testville",
          timezone: "America/Montreal",
          currency: "CAD",
          openingHours: [],
          serviceFees: [],
          floorMap: { width: 16, height: 9 },
          autoApproveGuests: false,
          logoInitials: "LL",
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
    };

    venueA = await makeVenue("Ledger Venue A", "ledger-a");
    venueB = await makeVenue("Ledger Venue B", "ledger-b");

    const db = getDb({ venueId: venueA });
    const cat = await createCategory(db, venueA, {
      name: "Spirits",
      description: "",
      sortOrder: 1,
    });
    const item = await createItem(db, venueA, {
      categoryId: cat.id,
      name: "Ledger Bottle",
      description: "",
      priceCents: 5000,
      icon: "champagne",
      tags: [],
      inventory: 10,
    });
    itemId = item.id;
  }, 60_000);

  afterAll(async () => {
    await testDb?.teardown();
  });

  it("applies a sale movement and keeps inventory === Σ movements.delta", async () => {
    const db = getDb({ venueId: venueA });
    const tx = getRawPrisma();
    await tx.$transaction(async (t) => {
      await applyMovement(t, {
        venueId: venueA,
        menuItemId: itemId,
        delta: -3,
        type: "sale",
        note: "Test sale",
        requireStock: 3,
      });
    });
    const item = await getItem(db, itemId);
    expect(item!.inventory).toBe(7);
    const ledger = await checkLedger(db, itemId);
    expect(ledger.balanced).toBe(true);
  });

  it("rejects a sale above stock without writing anything", async () => {
    const db = getDb({ venueId: venueA });
    const tx = getRawPrisma();
    await expect(
      tx.$transaction(async (t) => {
        await applyMovement(t, {
          venueId: venueA,
          menuItemId: itemId,
          delta: -999,
          type: "sale",
          requireStock: 999,
        });
      }),
    ).rejects.toThrow("Not enough stock");
    const item = await getItem(db, itemId);
    expect(item!.inventory).toBe(7); // unchanged
    const ledger = await checkLedger(db, itemId);
    expect(ledger.balanced).toBe(true);
  });

  it("rejects a movement on an unavailable item", async () => {
    const db = getDb({ venueId: venueA });
    await db.menuItem.update({ where: { id: itemId }, data: { isAvailable: false } });
    const tx = getRawPrisma();
    await expect(
      tx.$transaction(async (t) => {
        await applyMovement(t, {
          venueId: venueA,
          menuItemId: itemId,
          delta: -1,
          type: "sale",
          requireAvailable: true,
        });
      }),
    ).rejects.toThrow("not available");
    await db.menuItem.update({ where: { id: itemId }, data: { isAvailable: true } });
  });

  it("emits a sold-out event when a movement zeroes the count", async () => {
    const db = getDb({ venueId: venueA });
    const cat = await createCategory(db, venueA, { name: "Last call", description: "", sortOrder: 2 });
    const last = await createItem(db, venueA, {
      categoryId: cat.id,
      name: "Last Bottle",
      description: "",
      priceCents: 1000,
      icon: "champagne",
      tags: [],
      inventory: 1,
    });
    const tx = getRawPrisma();
    await tx.$transaction(async (t) => {
      await applyMovement(t, {
        venueId: venueA,
        menuItemId: last.id,
        delta: -1,
        type: "sale",
        emitSoldOut: true,
      });
    });
    const events = await db.soldOutEvent.findMany({ where: { itemId: last.id } });
    expect(events).toHaveLength(1);
  });

  it("restock and waste keep the invariant", async () => {
    const db = getDb({ venueId: venueA });
    const tx = getRawPrisma();
    await tx.$transaction(async (t) => {
      await applyMovement(t, { venueId: venueA, menuItemId: itemId, delta: 5, type: "restock", unitCostCents: 4000, purchaseOrderId: "po-x" });
      await applyMovement(t, { venueId: venueA, menuItemId: itemId, delta: -2, type: "waste", wasteReason: "spill", note: "spill" });
    });
    const item = await getItem(db, itemId);
    expect(item!.inventory).toBe(10);
    const ledger = await checkLedger(db, itemId);
    expect(ledger.balanced).toBe(true);
  });

  it("never oversells under concurrent draw-downs", async () => {
    const db = getDb({ venueId: venueA });
    const tx = getRawPrisma();
    const outcomes = await Promise.allSettled(
      [1, 2].map(() =>
        tx.$transaction(async (t) => {
          await applyMovement(t, {
            venueId: venueA,
            menuItemId: itemId,
            delta: -6,
            type: "sale",
            requireStock: 6,
          });
        }),
      ),
    );
    const succeeded = outcomes.filter((o) => o.status === "fulfilled").length;
    expect(succeeded).toBe(1); // only 10 in stock, each wants 6
    const item = await getItem(db, itemId);
    expect(item!.inventory).toBe(4);
    const ledger = await checkLedger(db, itemId);
    expect(ledger.balanced).toBe(true);
  });

  it("never loses updates under concurrent adjustments", async () => {
    const db = getDb({ venueId: venueA });
    const tx = getRawPrisma();
    await Promise.all(
      [1, 2].map(() =>
        tx.$transaction(async (t) => {
          await applyMovement(t, { venueId: venueA, menuItemId: itemId, delta: 1, type: "adjustment", note: "concurrent" });
        }),
      ),
    );
    const item = await getItem(db, itemId);
    expect(item!.inventory).toBe(6); // 4 + 2, neither adjustment lost
    const ledger = await checkLedger(db, itemId);
    expect(ledger.balanced).toBe(true);
  });

  it("stamps movements with the order they belong to (INV-05)", async () => {
    const db = getDb({ venueId: venueA });
    const order = await db.order.create({
      data: {
        venueId: venueA,
        code: "L-999",
        tableId: "t1",
        tableCode: "VIP-01",
        zoneId: "z1",
        zoneName: "VIP",
        guestName: "Ledger",
        subtotalCents: 1000,
        totalFeeCents: 100,
        tipCents: 0,
        totalCents: 1100,
        status: "pending",
      },
    });
    const tx = getRawPrisma();
    await tx.$transaction(async (t) => {
      await applyMovement(t, {
        venueId: venueA,
        menuItemId: itemId,
        delta: -1,
        type: "sale",
        orderId: order.id,
        note: `Order ${order.code}`,
      });
    });
    const movements = await db.stockMovement.findMany({
      where: { orderId: order.id, type: "sale" },
    });
    expect(movements).toHaveLength(1);
  });

  it("keeps one venue's movements invisible to another (AD-3)", async () => {
    const tx = getRawPrisma();
    let movementId = "";
    await tx.$transaction(async (t) => {
      const result = await applyMovement(t, {
        venueId: venueA,
        menuItemId: itemId,
        delta: -1,
        type: "adjustment",
        note: "tenant canary",
      });
      movementId = result.movementId ?? "";
    });
    await expectTenantIsolation(venueA, venueB, (scopedDb) =>
      scopedDb.stockMovement.findUnique({ where: { id: movementId } }),
    );
  });

  it("transition CAS — only one concurrent flip lands, and notIn guards exclude terminals", async () => {
    const db = getDb({ venueId: venueA });
    const order = await db.order.create({
      data: {
        venueId: venueA,
        code: "L-998",
        tableId: "t1",
        tableCode: "VIP-01",
        zoneId: "z1",
        zoneName: "VIP",
        guestName: "CAS",
        subtotalCents: 1000,
        totalFeeCents: 100,
        tipCents: 0,
        totalCents: 1100,
        status: "pending",
      },
    });
    const tx = getRawPrisma();
    const results = await Promise.all([
      tx.$transaction((t) => transition(t, "order", order.id, { from: "pending", to: "accepted" })),
      tx.$transaction((t) => transition(t, "order", order.id, { from: "pending", to: "accepted" })),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);

    const flip = await tx.$transaction((t) =>
      transition(t, "order", order.id, { from: { notIn: ["delivered", "cancelled"] }, to: "ready" }),
    );
    expect(flip).toBe(true);
    const blocked = await tx.$transaction((t) =>
      transition(t, "order", order.id, { from: { notIn: ["delivered", "cancelled", "ready"] }, to: "ready" }),
    );
    expect(blocked).toBe(false);
  });
});
