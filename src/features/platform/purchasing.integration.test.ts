import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getDb, type SessionContext } from "@/features/shared/db";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";
import {
  listSuppliers, saveSupplier, listSupplierItems, saveSupplierItem, removeSupplierItem,
  listPurchaseOrders, savePurchaseOrder, submitPurchaseOrder, receivePurchaseOrder,
  listStocktakes, saveStocktake, commitStocktake, listEightySixEntries, eightySixItem,
  recordWaste, listProfitTargets, saveProfitTarget,
  listEventCosts, saveEventCost, listInventoryChecklists, saveInventoryChecklist,
  getEventRunSheet, saveEventRunSheet,
} from "@/features/platform/purchasing-core";
import { expectTenantIsolation } from "@/features/shared/test-helpers";

type Row = Record<string, unknown>;

async function makeVenue(rawClient: PrismaClient, name: string, slug: string) {
  const org = await rawClient.organization.create({ data: { id: `org-${slug}`, name, slug } });
  await rawClient.venue.create({
    data: {
      id: org.id, address: "1 Test St", city: "Testville",
      timezone: "America/Montreal", currency: "CAD",
      openingHours: [], serviceFees: [],
      floorMap: { width: 16, height: 9 },
      autoApproveGuests: false, logoInitials: "TT",
      slaThresholds: { orderWarnMinutes: 6, orderCriticalMinutes: 12, helpWarnMinutes: 4, helpCriticalMinutes: 8 },
      lastCallAutoFlagTables: true,
    },
  });
  return org.id;
}

describe("purchasing integration (plan 19)", () => {
  let testDb: TestDb;
  let rawClient: PrismaClient;
  let venueA: string;
  let venueB: string;
  let sessionA: SessionContext;

  let categoryId: string;

  beforeAll(async () => {
    testDb = await createTestDb();
    rawClient = testDb.rawClient;
    venueA = await makeVenue(rawClient, "Venue A", "pur-int-a");
    venueB = await makeVenue(rawClient, "Venue B", "pur-int-b");
    sessionA = { venueId: venueA };

    // Create a menu category for menu item relations
    categoryId = "cat-test";
    await rawClient.menuCategory.create({
      data: { id: categoryId, venueId: venueA, name: "Test Category", sortOrder: 0 },
    });
  }, 60_000);

  afterAll(async () => {
    await testDb?.teardown();
  });

  function makeMenuItem(id: string, name: string, overrides: Row = {}) {
    return { id, venueId: venueA, name, categoryId, priceCents: 1000, inventory: 0, unitOfMeasure: "each", ...overrides };
  }

  // ── Tenant isolation ──────────────────────────────────────────────

  it("isolates supplier lists by tenant", async () => {
    const dbA = getDb({ venueId: venueA });
    await saveSupplier(dbA, {
      id: "sup-iso", venueId: venueA, name: "Iso Test Supplier",
      contactName: "Test", email: "iso@test.local", phone: "555-0001",
      accountNumber: "", leadTimeDays: 2, orderDays: [1, 4],
      minimumOrderCents: 0, notes: "", active: true,
    });

    await expectTenantIsolation(venueA, venueB, async (db) => {
      const suppliers = await listSuppliers(db);
      return suppliers.find((s) => s.id === "sup-iso") ?? null;
    });
  });

  it("isolates purchase order lists by tenant", async () => {
    const dbA = getDb({ venueId: venueA });
    await savePurchaseOrder(dbA, {
      id: "po-iso", venueId: venueA, supplierId: "sup-iso", code: "PO-ISO-001",
      status: "draft", expectedAt: "2026-08-01T10:00:00.000Z",
      lines: [], subtotalCents: 0, notes: "",
    });

    await expectTenantIsolation(venueA, venueB, async (db) => {
      const pos = await listPurchaseOrders(db);
      return pos.find((p) => p.id === "po-iso") ?? null;
    });
  });

  it("isolates stocktake lists by tenant", async () => {
    const dbA = getDb({ venueId: venueA });
    await saveStocktake(dbA, {
      id: "st-iso", venueId: venueA, businessDate: "2026-08-01",
      scope: "full", status: "open", startedAt: "2026-07-31T22:00:00.000Z",
      startedByStaffId: "stf-1", lines: [], totalVarianceCents: 0,
    });

    await expectTenantIsolation(venueA, venueB, async (db) => {
      const sts = await listStocktakes(db);
      return sts.find((s) => s.id === "st-iso") ?? null;
    });
  });

  // ── Supplier CRUD ─────────────────────────────────────────────────

  it("creates and lists a supplier", async () => {
    const db = getDb(sessionA);
    const sup = await saveSupplier(db, {
      id: "sup-crud", venueId: venueA, name: "CRUD Supplier",
      contactName: "C", email: "crud@test.local", phone: "555-CRUD",
      accountNumber: "ACC-001", leadTimeDays: 3, orderDays: [0, 3],
      minimumOrderCents: 5000, notes: "", active: true,
    });
    expect(sup.name).toBe("CRUD Supplier");

    const list = await listSuppliers(db);
    expect(list.some((s) => s.id === "sup-crud")).toBe(true);
  });

  it("updates an existing supplier", async () => {
    const db = getDb(sessionA);
    const sup = await saveSupplier(db, {
      id: "sup-crud", venueId: venueA, name: "CRUD Supplier Updated",
      contactName: "C", email: "crud2@test.local", phone: "555-CRUD2",
      accountNumber: "ACC-001", leadTimeDays: 3, orderDays: [0, 3],
      minimumOrderCents: 5000, notes: "", active: true,
    });
    expect(sup.name).toBe("CRUD Supplier Updated");
  });

  // ── Supplier items ────────────────────────────────────────────────

  it("creates, lists, and removes supplier items", async () => {
    const db = getDb(sessionA);
    // First we need a menuItem — create via raw client
    const menuItemId = "mi-test";
    await rawClient.menuItem.create({ data: makeMenuItem(menuItemId, "Test Vodka", { priceCents: 1200, inventory: 5, unitOfMeasure: "bottle", servingSize: 750 }) });

    const si = await saveSupplierItem(db, {
      id: "si-test", supplierId: "sup-crud", menuItemId,
      supplierSku: "SKU-007", caseSize: 12, caseCostCents: 48000, unitCostCents: 4000,
      lastPriceChangeAt: "2026-07-01T00:00:00.000Z", preferred: true,
    });
    expect(si.supplierSku).toBe("SKU-007");

    const list = await listSupplierItems(db, "sup-crud");
    expect(list).toHaveLength(1);

    await removeSupplierItem(db, "si-test");
    const after = await listSupplierItems(db, "sup-crud");
    expect(after).toHaveLength(0);
  });

  // ── Purchase order lifecycle ──────────────────────────────────────

  it("flows a PO: draft → submit → receive (fully)", async () => {
    const db = getDb(sessionA);
    const menuItemId = "mi-po";
    await rawClient.menuItem.create({ data: makeMenuItem(menuItemId, "PO Test Item", { priceCents: 1500, inventory: 3, unitOfMeasure: "bottle", servingSize: 750 }) });

    // Create
    const po = await savePurchaseOrder(db, {
      id: "po-lifecycle", venueId: venueA, supplierId: "sup-crud", code: "PO-LIFE-001",
      status: "draft", expectedAt: "2026-08-01T10:00:00.000Z",
      lines: [{
        id: "pol-1", menuItemId, qtyOrdered: 10, qtyReceived: 0,
        unitCostCents: 4000, lineTotalCents: 40000,
      }],
      subtotalCents: 40000, notes: "Test lifecycle",
    });
    expect(po.status).toBe("draft");

    // Submit
    const submitted = await submitPurchaseOrder(db, "po-lifecycle", "stf-1");
    expect(submitted.status).toBe("submitted");
    expect(submitted.submittedByStaffId).toBe("stf-1");

    // Receive fully
    const received = await receivePurchaseOrder(db, "po-lifecycle", [
      { lineId: "pol-1", qtyReceived: 10 },
    ]);
    expect(received.status).toBe("received");
    expect(received.lines[0].qtyReceived).toBe(10);

    // Verify inventory bumped
    const item = await rawClient.menuItem.findUnique({ where: { id: menuItemId } });
    expect(item?.inventory).toBe(13); // 3 + 10
  });

  it("sets PO to partially-received when some lines remain", async () => {
    const db = getDb(sessionA);
    const menuItemId = "mi-partial";
    await rawClient.menuItem.create({ data: makeMenuItem(menuItemId, "Partial Item", { priceCents: 800, unitOfMeasure: "can" }) });

    await savePurchaseOrder(db, {
      id: "po-partial", venueId: venueA, supplierId: "sup-crud", code: "PO-PART-001",
      status: "draft", expectedAt: "2026-08-01T10:00:00.000Z",
      lines: [{
        id: "pol-p1", menuItemId, qtyOrdered: 24, qtyReceived: 0,
        unitCostCents: 200, lineTotalCents: 4800,
      }],
      subtotalCents: 4800, notes: "",
    });
    await submitPurchaseOrder(db, "po-partial", "stf-1");

    const partial = await receivePurchaseOrder(db, "po-partial", [
      { lineId: "pol-p1", qtyReceived: 10 },
    ]);
    expect(partial.status).toBe("partially-received");
  });

  it("rejects receiving a draft PO", async () => {
    const db = getDb(sessionA);
    await savePurchaseOrder(db, {
      id: "po-draft", venueId: venueA, supplierId: "sup-crud", code: "PO-DRAFT-001",
      status: "draft", expectedAt: "2026-08-01T10:00:00.000Z",
      lines: [], subtotalCents: 0, notes: "",
    });

    await expect(
      receivePurchaseOrder(db, "po-draft", [{ lineId: "x", qtyReceived: 1 }]),
    ).rejects.toThrow("submitted or partially-received");
  });

  // ── WAC recalculation on receive ──────────────────────────────────

  it("recomputes weighted average cost on PO receive", async () => {
    const db = getDb(sessionA);
    const menuItemId = "mi-wac";
    await rawClient.menuItem.create({ data: makeMenuItem(menuItemId, "WAC Item", { priceCents: 2000, inventory: 5, avgCostCents: 3500, unitOfMeasure: "bottle", servingSize: 750 }) });

    await savePurchaseOrder(db, {
      id: "po-wac", venueId: venueA, supplierId: "sup-crud", code: "PO-WAC-001",
      status: "draft", expectedAt: "2026-08-01T10:00:00.000Z",
      lines: [{
        id: "pol-w1", menuItemId, qtyOrdered: 5, qtyReceived: 0,
        unitCostCents: 4500, lineTotalCents: 22500,
      }],
      subtotalCents: 22500, notes: "",
    });
    await submitPurchaseOrder(db, "po-wac", "stf-1");
    await receivePurchaseOrder(db, "po-wac", [{ lineId: "pol-w1", qtyReceived: 5 }]);

    const item = await rawClient.menuItem.findUnique({ where: { id: menuItemId } });
    // WAC: (5 * 3500 + 5 * 4500) / 10 = 40000 / 10 = 4000
    expect(item?.avgCostCents).toBe(4000);
    expect(item?.inventory).toBe(10);
  });

  // ── Stocktake lifecycle ───────────────────────────────────────────

  it("flows a stocktake: open → counting → commit", async () => {
    const db = getDb(sessionA);
    const menuItemId = "mi-st";
    await rawClient.menuItem.create({ data: makeMenuItem(menuItemId, "Stocktake Item", { priceCents: 1800, inventory: 8, unitOfMeasure: "bottle", servingSize: 750 }) });

    const st = await saveStocktake(db, {
      id: "st-lifecycle", venueId: venueA, businessDate: "2026-08-01",
      scope: "full", status: "open", startedAt: "2026-07-31T22:00:00.000Z",
      startedByStaffId: "stf-1", lines: [{
        id: "stl-1", menuItemId, expectedQty: 8, countedQty: 5, varianceQty: -3, varianceCents: -6000,
      }],
      totalVarianceCents: -6000,
    });
    expect(st.status).toBe("open");

    // Move to counting
    const counting = await saveStocktake(db, {
      ...st, status: "counting",
    });
    expect(counting.status).toBe("counting");

    // Commit
    const committed = await commitStocktake(db, "st-lifecycle");
    expect(committed.status).toBe("committed");
    expect(committed.totalVarianceCents).toBe(-6000);

    // Verify inventory adjusted by variance (+ varianceQty = -3)
    const item = await rawClient.menuItem.findUnique({ where: { id: menuItemId } });
    expect(item?.inventory).toBe(5); // 8 - 3
  });

  it("rejects committing a stocktake not in counting status", async () => {
    const db = getDb(sessionA);
    await saveStocktake(db, {
      id: "st-committed", venueId: venueA, businessDate: "2026-08-01",
      scope: "full", status: "committed", startedAt: "2026-07-31T22:00:00.000Z",
      startedByStaffId: "stf-1", lines: [], totalVarianceCents: 0,
    });

    await expect(commitStocktake(db, "st-committed")).rejects.toThrow("counting");
  });

  // ── Eighty-six and waste ──────────────────────────────────────────

  it("creates and lists eighty-six entries", async () => {
    const db = getDb(sessionA);
    const menuItemId = "mi-86";
    await rawClient.menuItem.create({ data: makeMenuItem(menuItemId, "86'd Item", { priceCents: 1000, unitOfMeasure: "bottle", servingSize: 750 }) });

    const entry = await eightySixItem(db, menuItemId, "Out of stock", "stf-1");
    expect(entry.menuItemId).toBe(menuItemId);
    expect(entry.reason).toBe("Out of stock");

    const list = await listEightySixEntries(db);
    expect(list.some((e) => e.menuItemId === menuItemId)).toBe(true);
  });

  it("records waste and creates a stock movement with negative delta", async () => {
    const db = getDb(sessionA);
    const menuItemId = "mi-waste";
    await rawClient.menuItem.create({ data: makeMenuItem(menuItemId, "Spoiled Item", { priceCents: 500, inventory: 10, unitOfMeasure: "can" }) });

    const mvt = await recordWaste(db, menuItemId, 3, "Damaged in transit", "stf-1");
    expect(mvt.type).toBe("waste");
    expect(mvt.delta).toBe(-3);
    expect(mvt.wasteReason).toBe("Damaged in transit");

    const item = await rawClient.menuItem.findUnique({ where: { id: menuItemId } });
    expect(item?.inventory).toBe(7); // 10 - 3
  });

  // ── Profit targets ────────────────────────────────────────────────

  it("creates and lists profit targets", async () => {
    const db = getDb(sessionA);
    const pt = await saveProfitTarget(db, {
      id: "pt-test", venueId: venueA, metric: "pour-cost",
      scope: "venue", categoryId: undefined,
      targetValue: 0.22, warnAt: 0.25, direction: "above",
    });
    expect(pt.metric).toBe("pour-cost");

    const list = await listProfitTargets(db);
    expect(list.some((p) => p.id === "pt-test")).toBe(true);
  });

  // ── Event costs ───────────────────────────────────────────────────

  it("creates and lists event costs by event", async () => {
    const db = getDb(sessionA);
    const ec = await saveEventCost(db, {
      id: "ec-test", eventId: "evt-1", label: "DJ Fee",
      kind: "talent", amountCents: 150000,
    });
    expect(ec.label).toBe("DJ Fee");

    const list = await listEventCosts(db, "evt-1");
    expect(list).toHaveLength(1);
    expect(list[0].amountCents).toBe(150000);
  });

  // ── Inventory checklists ──────────────────────────────────────────

  it("creates and lists inventory checklists", async () => {
    const db = getDb(sessionA);
    const cl = await saveInventoryChecklist(db, {
      id: "cl-test", venueId: venueA, businessDate: "2026-08-01",
      type: "pre-service", status: "open",
      startedAt: "2026-07-31T20:00:00.000Z",
      lines: [{
        id: "cle-1", menuItemId: "mi-1", itemName: "Test Item",
        expectedCount: 10, actualCount: undefined, checked: false,
      }],
    });
    expect(cl.type).toBe("pre-service");
    expect(cl.status).toBe("open");

    const list = await listInventoryChecklists(db, "pre-service");
    expect(list.some((c) => c.id === "cl-test")).toBe(true);
  });

  it("filters inventory checklists by type", async () => {
    const db = getDb(sessionA);
    await saveInventoryChecklist(db, {
      id: "cl-post", venueId: venueA, businessDate: "2026-08-01",
      type: "post-service", status: "open",
      startedAt: "2026-08-01T04:00:00.000Z",
      lines: [],
    });

    const pre = await listInventoryChecklists(db, "pre-service");
    const post = await listInventoryChecklists(db, "post-service");
    expect(pre.every((c) => c.type === "pre-service")).toBe(true);
    expect(post.every((c) => c.type === "post-service")).toBe(true);
  });

  // ── Event run sheets ─────────────────────────────────────────────

  it("creates and retrieves an event run sheet", async () => {
    const db = getDb(sessionA);
    const entries = [
      { time: "21:00", label: "Doors open", description: "Security at all posts" },
      { time: "22:00", label: "Headliner", description: "DJ set starts" },
    ];
    await saveEventRunSheet(db, venueA, "evt-rs-test", entries);
    const sheet = await getEventRunSheet(db, "evt-rs-test");
    expect(sheet.eventId).toBe("evt-rs-test");
    expect(sheet.entries).toHaveLength(2);
    expect(sheet.entries[0].label).toBe("Doors open");
  });

  it("returns empty entries for unknown event", async () => {
    const db = getDb(sessionA);
    const sheet = await getEventRunSheet(db, "nonexistent");
    expect(sheet.eventId).toBe("nonexistent");
    expect(sheet.entries).toEqual([]);
  });

  it("updates an existing run sheet (upsert)", async () => {
    const db = getDb(sessionA);
    const entries = [{ time: "20:00", label: "Setup", description: "" }];
    await saveEventRunSheet(db, venueA, "evt-rs-upsert", entries);

    const updated = [{ time: "20:30", label: "Setup delayed" }];
    await saveEventRunSheet(db, venueA, "evt-rs-upsert", updated);
    const sheet = await getEventRunSheet(db, "evt-rs-upsert");
    expect(sheet.entries).toHaveLength(1);
    expect(sheet.entries[0].label).toBe("Setup delayed");
  });
});
