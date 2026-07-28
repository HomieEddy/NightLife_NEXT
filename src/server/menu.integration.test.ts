import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getDb, type SessionContext } from "../features/shared/db";
import { createTestDb, type TestDb } from "../features/shared/test-pglite";
import {
  listCategories,
  createCategory,
  updateCategory,
  toggleCategory,
  deleteCategory,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  listMovements,
  restockItem,
  bulkRestock,
  adjustInventory,
  recordSale,
  listSoldOutEvents,
  listPackages,
  getPackage,
  createPackage,
  updatePackage,
  deletePackage,
  listHappyHourRules,
  createHappyHourRule,
  updateHappyHourRule,
  toggleHappyHourRule,
  deleteHappyHourRule,
  checkLedger,
} from "@/features/menu/core";
import { expectTenantIsolation } from "../features/shared/test-helpers";
import { toCents } from "../features/shared/money";

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

describe("menu/inventory/packages integration (plan 04)", () => {
  let testDb: TestDb;
  let rawClient: PrismaClient;
  let venueA: string;
  let venueB: string;
  let sessionA: SessionContext;

  beforeAll(async () => {
    testDb = await createTestDb();
    rawClient = testDb.rawClient;

    venueA = await makeVenue(rawClient, "Menu Venue A", "menu-a-int");
    venueB = await makeVenue(rawClient, "Menu Venue B", "menu-b-int");
    sessionA = { venueId: venueA };
  }, 60_000);

  afterAll(async () => {
    await testDb?.teardown();
  });

  // ── Category CRUD ────────────────────────────────────────────────────

  it("creates, lists, updates and toggles categories", async () => {
    const db = getDb(sessionA);
    const cat = await createCategory(db, venueA, {
      name: "Champagne",
      description: "Bubbly",
      sortOrder: 1,
    });
    expect(cat.name).toBe("Champagne");
    expect(cat.isActive).toBe(true);

    const cats = await listCategories(db, true);
    expect(cats.some((c) => c.id === cat.id)).toBe(true);

    const updated = await updateCategory(db, cat.id, { name: "Champagne & Sparkling" });
    expect(updated?.name).toBe("Champagne & Sparkling");

    const toggled = await toggleCategory(db, cat.id);
    expect(toggled?.isActive).toBe(false);

    const activeCats = await listCategories(db, false);
    expect(activeCats.some((c) => c.id === cat.id)).toBe(false);
  });

  it("round-trips category add-on presets", async () => {
    const db = getDb(sessionA);
    const cat = await createCategory(db, venueA, {
      name: "Preset Category",
      description: "",
      sortOrder: 20,
      modifierGroups: [{
        id: "washers",
        name: "Washers",
        kind: "washer",
        required: false,
        maxSelections: 2,
        isActive: true,
        options: [{
          id: "soda",
          name: "Soda",
          priceDelta: 4,
          maxQuantity: 3,
          isActive: true,
        }],
      }],
    });

    expect(cat.modifierGroups[0].options[0].priceDelta).toBe(4);
    const updated = await updateCategory(db, cat.id, {
      modifierGroups: [{
        ...cat.modifierGroups[0],
        options: [{ ...cat.modifierGroups[0].options[0], priceDelta: 6 }],
      }],
    });
    expect(updated?.modifierGroups[0].options[0].priceDelta).toBe(6);
    expect((await listCategories(db, true)).find((row) => row.id === cat.id)?.modifierGroups)
      .toEqual(updated?.modifierGroups);
  });

  it("blocks deleting a category referenced by an item", async () => {
    const db = getDb(sessionA);
    const cat = await createCategory(db, venueA, {
      name: "Referenced Category",
      description: "",
      sortOrder: 21,
    });
    const item = await createItem(db, venueA, {
      categoryId: cat.id,
      name: "Referenced Bottle",
      description: "",
      priceCents: 1000,
      icon: "vodka",
      tags: [],
    });

    expect(await deleteCategory(db, cat.id)).toBe(false);
    await deleteItem(db, item.id);
    expect(await deleteCategory(db, cat.id)).toBe(true);
  });

  // ── Item CRUD + ledger ───────────────────────────────────────────────

  it("creates an item with initial stock and verifies INV-I1", async () => {
    const db = getDb(sessionA);
    const cat = await createCategory(db, venueA, {
      name: "Vodka",
      description: "",
      sortOrder: 2,
    });
    const item = await createItem(db, venueA, {
      categoryId: cat.id,
      name: "Grey Goose",
      description: "French vodka",
      priceCents: toCents(220),
      icon: "vodka",
      tags: [],
      inventory: 10,
    });
    expect(item.inventory).toBe(10);
    expect(item.price).toBe(220);

    const ledger = await checkLedger(db, item.id);
    expect(ledger.balanced).toBe(true);
    expect(ledger.inventory).toBe(10);
    expect(ledger.movementSum).toBe(10);
  });

  it("restock increments and preserves INV-I1", async () => {
    const db = getDb(sessionA);
    const cat = await createCategory(db, venueA, {
      name: "Tequila",
      description: "",
      sortOrder: 3,
    });
    const item = await createItem(db, venueA, {
      categoryId: cat.id,
      name: "Don Julio",
      description: "",
      priceCents: toCents(340),
      icon: "tequila",
      tags: [],
      inventory: 5,
    });

    const restocked = await restockItem(db, venueA, item.id, { quantity: 8, note: "Delivery" });
    expect(restocked?.inventory).toBe(13);

    const ledger = await checkLedger(db, item.id);
    expect(ledger.balanced).toBe(true);
  });

  it("bulkRestock produces one movement per line", async () => {
    const db = getDb(sessionA);
    const cat = await createCategory(db, venueA, {
      name: "Gin",
      description: "",
      sortOrder: 4,
    });
    const a = await createItem(db, venueA, {
      categoryId: cat.id,
      name: "Hendricks",
      description: "",
      priceCents: toCents(210),
      icon: "gin",
      tags: [],
      inventory: 0,
    });
    const b = await createItem(db, venueA, {
      categoryId: cat.id,
      name: "Monkey 47",
      description: "",
      priceCents: toCents(250),
      icon: "gin",
      tags: [],
      inventory: 0,
    });

    const applied = await bulkRestock(db, venueA, {
      lines: [
        { itemId: a.id, quantity: 5 },
        { itemId: b.id, quantity: 3 },
      ],
      note: "Bulk delivery",
    });
    expect(applied).toBe(2);

    expect((await checkLedger(db, a.id)).balanced).toBe(true);
    expect((await checkLedger(db, b.id)).balanced).toBe(true);
  });

  it("adjustInventory sets exact count and preserves INV-I1", async () => {
    const db = getDb(sessionA);
    const cat = await createCategory(db, venueA, {
      name: "Cognac",
      description: "",
      sortOrder: 5,
    });
    const item = await createItem(db, venueA, {
      categoryId: cat.id,
      name: "Hennessy",
      description: "",
      priceCents: toCents(260),
      icon: "cognac",
      tags: [],
      inventory: 10,
    });

    const adjusted = await adjustInventory(db, venueA, item.id, { newCount: 3, note: "Broken bottles" });
    expect(adjusted?.inventory).toBe(3);

    const ledger = await checkLedger(db, item.id);
    expect(ledger.balanced).toBe(true);
  });

  it("adjustInventory to zero emits a sold-out event (INV-I2)", async () => {
    const db = getDb(sessionA);
    const cat = await createCategory(db, venueA, {
      name: "Rum-86",
      description: "",
      sortOrder: 6,
    });
    const item = await createItem(db, venueA, {
      categoryId: cat.id,
      name: "Rum 86 Test",
      description: "",
      priceCents: toCents(100),
      icon: "rum",
      tags: [],
      inventory: 5,
    });

    await adjustInventory(db, venueA, item.id, { newCount: 0, note: "86'd" });

    const events = await listSoldOutEvents(db, 5);
    expect(events.some((e) => e.itemId === item.id)).toBe(true);
  });

  // ── recordSale with row locks ────────────────────────────────────────

  it("recordSale decrements and preserves INV-I1", async () => {
    const db = getDb(sessionA);
    const cat = await createCategory(db, venueA, {
      name: "Sale-Cat",
      description: "",
      sortOrder: 7,
    });
    const item = await createItem(db, venueA, {
      categoryId: cat.id,
      name: "Sale Item",
      description: "",
      priceCents: toCents(100),
      icon: "champagne",
      tags: [],
      inventory: 10,
    });

    const result = await recordSale(db, venueA, {
      lines: [{ menuItemId: item.id, quantity: 3 }],
    });
    expect(result.ok).toBe(true);

    const after = await getItem(db, item.id);
    expect(after?.inventory).toBe(7);

    const ledger = await checkLedger(db, item.id);
    expect(ledger.balanced).toBe(true);
  });

  it("recordSale rejects oversell", async () => {
    const db = getDb(sessionA);
    const cat = await createCategory(db, venueA, {
      name: "Oversell-Cat",
      description: "",
      sortOrder: 8,
    });
    const item = await createItem(db, venueA, {
      categoryId: cat.id,
      name: "Scarce Bottle",
      description: "",
      priceCents: toCents(500),
      icon: "champagne",
      tags: [],
      inventory: 2,
    });

    const result = await recordSale(db, venueA, {
      lines: [{ menuItemId: item.id, quantity: 5 }],
    });
    expect(result.ok).toBe(false);

    const after = await getItem(db, item.id);
    expect(after?.inventory).toBe(2);
  });

  it("recordSale to zero emits sold-out (INV-I2)", async () => {
    const db = getDb(sessionA);
    const cat = await createCategory(db, venueA, {
      name: "SaleZero-Cat",
      description: "",
      sortOrder: 9,
    });
    const item = await createItem(db, venueA, {
      categoryId: cat.id,
      name: "Last Bottle",
      description: "",
      priceCents: toCents(100),
      icon: "champagne",
      tags: [],
      inventory: 1,
    });

    await recordSale(db, venueA, {
      lines: [{ menuItemId: item.id, quantity: 1 }],
    });

    const events = await listSoldOutEvents(db, 5);
    expect(events.some((e) => e.itemId === item.id)).toBe(true);
  });

  it("concurrent recordSale never oversells (row-lock proof)", async () => {
    const db = getDb(sessionA);
    const cat = await createCategory(db, venueA, {
      name: "Concurrency-Cat",
      description: "",
      sortOrder: 10,
    });
    const item = await createItem(db, venueA, {
      categoryId: cat.id,
      name: "Concurrency Bottle",
      description: "",
      priceCents: toCents(100),
      icon: "champagne",
      tags: [],
      inventory: 3,
    });

    const results = await Promise.all([
      recordSale(db, venueA, { lines: [{ menuItemId: item.id, quantity: 2 }] }),
      recordSale(db, venueA, { lines: [{ menuItemId: item.id, quantity: 2 }] }),
    ]);

    const successes = results.filter((r) => r.ok).length;
    const failures = results.filter((r) => !r.ok).length;
    expect(successes).toBe(1);
    expect(failures).toBe(1);

    const after = await getItem(db, item.id);
    expect(after?.inventory).toBe(1);

    const ledger = await checkLedger(db, item.id);
    expect(ledger.balanced).toBe(true);
  });

  // ── Manual 86 toggle ─────────────────────────────────────────────────

  it("updateItem with isAvailable=false emits sold-out event", async () => {
    const db = getDb(sessionA);
    const cat = await createCategory(db, venueA, {
      name: "Toggle-Cat",
      description: "",
      sortOrder: 11,
    });
    const item = await createItem(db, venueA, {
      categoryId: cat.id,
      name: "86 Toggle Item",
      description: "",
      priceCents: toCents(100),
      icon: "champagne",
      tags: [],
      inventory: 5,
    });

    await updateItem(db, venueA, item.id, { isAvailable: false });

    const events = await listSoldOutEvents(db, 5);
    expect(events.some((e) => e.itemId === item.id)).toBe(true);
  });

  // ── Packages + INV-I3 ───────────────────────────────────────────────

  it("creates, lists, updates and deletes packages", async () => {
    const db = getDb(sessionA);
    const cat = await createCategory(db, venueA, {
      name: "Pkg-Cat",
      description: "",
      sortOrder: 12,
    });
    const item = await createItem(db, venueA, {
      categoryId: cat.id,
      name: "Package Item",
      description: "",
      priceCents: toCents(100),
      icon: "champagne",
      tags: [],
      inventory: 10,
    });

    const pkg = await createPackage(db, venueA, {
      name: "Test Package",
      description: "A test",
      priceCents: toCents(180),
      components: [{ menuItemId: item.id, quantity: 2 }],
    });
    expect(pkg.name).toBe("Test Package");

    const pkgs = await listPackages(db, true);
    const found = pkgs.find((p) => p.id === pkg.id);
    expect(found).toBeDefined();
    expect(found!.quote.maxQuantity).toBe(5);
    expect(found!.quote.savings).toBe(20);

    const updated = await updatePackage(db, pkg.id, { name: "Renamed Package" });
    expect(updated?.name).toBe("Renamed Package");

    await deletePackage(db, pkg.id);
    const afterDelete = await getPackage(db, pkg.id);
    expect(afterDelete).toBeNull();
  });

  it("round-trips package add-on presets", async () => {
    const db = getDb(sessionA);
    const cat = await createCategory(db, venueA, {
      name: "Package Preset Category",
      description: "",
      sortOrder: 22,
    });
    const item = await createItem(db, venueA, {
      categoryId: cat.id,
      name: "Package Preset Bottle",
      description: "",
      priceCents: 10000,
      icon: "champagne",
      tags: [],
      inventory: 5,
    });
    const modifierGroups = [{
      id: "presentation",
      name: "Presentation",
      kind: "presentation" as const,
      required: false,
      maxSelections: 1,
      isActive: true,
      options: [{
        id: "show",
        name: "Light show",
        priceDelta: 25,
        maxQuantity: 1,
        isActive: true,
      }],
    }];

    const pkg = await createPackage(db, venueA, {
      name: "Preset Package",
      description: "",
      priceCents: 9000,
      components: [{ menuItemId: item.id, quantity: 1 }],
      modifierGroups,
    });
    expect((await getPackage(db, pkg.id))?.modifierGroups).toEqual(modifierGroups);

    const updatedGroups = [{
      ...modifierGroups[0],
      options: [{ ...modifierGroups[0].options[0], priceDelta: 40 }],
    }];
    await updatePackage(db, pkg.id, { modifierGroups: updatedGroups });
    expect((await getPackage(db, pkg.id))?.modifierGroups).toEqual(updatedGroups);
  });

  it("rejects deleting an item referenced by an active package (INV-I3)", async () => {
    const db = getDb(sessionA);
    const cat = await createCategory(db, venueA, {
      name: "Guard-Cat",
      description: "",
      sortOrder: 13,
    });
    const item = await createItem(db, venueA, {
      categoryId: cat.id,
      name: "Guarded Item",
      description: "",
      priceCents: toCents(100),
      icon: "champagne",
      tags: [],
      inventory: 10,
    });
    const pkg = await createPackage(db, venueA, {
      name: "Guard Package",
      description: "",
      priceCents: toCents(90),
      components: [{ menuItemId: item.id, quantity: 1 }],
    });

    const result = await deleteItem(db, item.id);
    expect(result.ok).toBe(false);
    expect(result.blockedBy).toContain("Guard Package");

    await deletePackage(db, pkg.id);
    const allowed = await deleteItem(db, item.id);
    expect(allowed.ok).toBe(true);
  });

  // ── Happy hour CRUD ──────────────────────────────────────────────────

  it("creates, lists, toggles, updates and deletes happy hour rules", async () => {
    const db = getDb(sessionA);
    const rule = await createHappyHourRule(db, venueA, {
      name: "5 à 7",
      daysOfWeek: [4, 5],
      startTime: "22:00",
      endTime: "23:30",
      discountPct: 15,
      appliesToCategoryIds: [],
    });
    expect(rule.isActive).toBe(true);

    const rules = await listHappyHourRules(db);
    expect(rules.some((r) => r.id === rule.id)).toBe(true);

    const toggled = await toggleHappyHourRule(db, rule.id);
    expect(toggled?.isActive).toBe(false);

    const updated = await updateHappyHourRule(db, rule.id, { name: "Happy Hour" });
    expect(updated?.name).toBe("Happy Hour");

    await deleteHappyHourRule(db, rule.id);
    const afterDelete = await listHappyHourRules(db);
    expect(afterDelete.some((r) => r.id === rule.id)).toBe(false);
  });

  // ── Movements log ────────────────────────────────────────────────────

  it("listMovements returns movements in reverse chronological order", async () => {
    const db = getDb(sessionA);
    const movements = await listMovements(db, 5);
    for (let i = 1; i < movements.length; i++) {
      expect(new Date(movements[i - 1].createdAt).getTime())
        .toBeGreaterThanOrEqual(new Date(movements[i].createdAt).getTime());
    }
  });

  // ── Tenant isolation ─────────────────────────────────────────────────

  it("never leaks categories across venues (AD-3 canary)", async () => {
    const dbB = getDb({ venueId: venueB });
    const marker = await createCategory(dbB, venueB, {
      name: "Venue B Only",
      description: "",
      sortOrder: 1,
    });

    await expectTenantIsolation(venueB, venueA, (db) =>
      db.menuCategory.findUnique({ where: { id: marker.id } }),
    );
  });

  it("never leaks items across venues (AD-3 canary)", async () => {
    const dbB = getDb({ venueId: venueB });
    const cat = await createCategory(dbB, venueB, {
      name: "B-Cat",
      description: "",
      sortOrder: 2,
    });
    const marker = await createItem(dbB, venueB, {
      categoryId: cat.id,
      name: "B-Item",
      description: "",
      priceCents: 1000,
      icon: "champagne",
      tags: [],
      inventory: 5,
    });

    await expectTenantIsolation(venueB, venueA, (db) =>
      db.menuItem.findUnique({ where: { id: marker.id } }),
    );
  });
});
