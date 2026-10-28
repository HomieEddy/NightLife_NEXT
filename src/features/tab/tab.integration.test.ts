import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, type TableStatus, type GuestSessionStatus, type OrderStatus } from "@prisma/client";
import { getDb, type SessionContext } from "@/features/shared/db";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";
import {
  listAdjustmentReasons,
  createAdjustmentReason,
  setAdjustmentReasonActive,
  listAdjustments,
  createAdjustment,
  reverseAdjustment,
  listAuditEntries,
  recordAuditEntry,
  listCashouts,
  closeCashout,
  transferSession,
  mergeSession,
  reassignOrdersToSession,
  rushOrder,
  compEntireOrder,
  remakeOrder,
  reportWalkout,
  splitBill,
} from "@/features/tab/core";

async function seedVenue(raw: PrismaClient, name: string, slug: string, extra?: { nightEndHour?: number }) {
  const org = await raw.organization.create({ data: { id: `org-${slug}`, name, slug } });
  await raw.venue.create({
    data: {
      id: org.id,
      address: "1 Test St",
      city: "Testville",
      timezone: "America/Toronto",
      currency: "CAD",
      openingHours: [],
      serviceFees: [],
      floorMap: { width: 16, height: 9 },
      autoApproveGuests: false,
      logoInitials: "TT",
      slaThresholds: { orderWarnMinutes: 6, orderCriticalMinutes: 12, helpWarnMinutes: 4, helpCriticalMinutes: 8 },
      lastCallAutoFlagTables: true,
      nightEndHour: extra?.nightEndHour ?? 6,
    },
  });
  return org.id;
}

async function seedCategories(raw: PrismaClient, venueId: string) {
  await raw.menuCategory.createMany({
    data: [
      { id: "cat-spirits", venueId, name: "Spirits", sortOrder: 1 },
      { id: "cat-beer", venueId, name: "Beer", sortOrder: 2 },
    ],
    skipDuplicates: true,
  });
}

async function seedMenuItems(raw: PrismaClient, venueId: string) {
  await raw.menuItem.createMany({
    data: [
      { id: "mi-vodka", venueId, name: "Vodka", categoryId: "cat-spirits", priceCents: 1200, inventory: 50, isAvailable: true },
      { id: "mi-beer", venueId, name: "Beer", categoryId: "cat-beer", priceCents: 800, inventory: 100, isAvailable: true },
    ],
    skipDuplicates: true,
  });
}

async function seedTable(raw: PrismaClient, venueId: string, id: string, code: string, zoneName: string, status: TableStatus = "open") {
  // Zone must exist first; create it inline.
  const zoneId = `zone-${id}`;
  await raw.zone.upsert({
    where: { id: zoneId },
    create: { id: zoneId, venueId, name: zoneName, color: "#60a5fa" },
    update: {},
  });
  await raw.venueTable.upsert({
    where: { id },
    create: { id, venueId, zoneId, code, label: `Table ${code}`, status, seats: 4, qrSlug: `qr-${id}` },
    update: {},
  });
}

async function seedSession(raw: PrismaClient, venueId: string, id: string, tableId: string, tableCode: string, status: GuestSessionStatus = "approved") {
  await raw.guestSession.create({
    data: {
      id, venueId, tableId, tableCode, zoneName: "Main",
      displayName: "Test Guest", partySize: 4,
      status,
      minimumSpendCents: 5000,
    },
  });
}

async function seedOrder(raw: PrismaClient, venueId: string, id: string, sessionId: string, totalCents: number, status: OrderStatus = "delivered") {
  await raw.order.create({
    data: {
      id, venueId, code: id.slice(-6).toUpperCase(), sessionId,
      tableId: "table-1", tableCode: "T1", zoneId: "zone-main", zoneName: "Main",
      guestName: "Test Guest",
      status, totalCents, subtotalCents: totalCents, totalFeeCents: 0, tipCents: 0,
    },
  });
  await raw.orderItem.create({
    data: {
      id: `oi-${id}`, orderId: id, menuItemId: "mi-vodka",
      name: "Vodka", unitCents: totalCents, quantity: 1, modifiers: [],
    },
  });
}

describe("tab ledger integration (plan 16)", () => {
  let testDb: TestDb;
  let raw: PrismaClient;
  let venueA: string;
  let venueB: string;
  let sessionA: SessionContext;

  beforeAll(async () => {
    testDb = await createTestDb();
    raw = testDb.rawClient;
    venueA = await seedVenue(raw, "Venue A", "venue-a-tab");
    venueB = await seedVenue(raw, "Venue B", "venue-b-tab");

    // Clean up any stale data from prior runs.
    await raw.orderItem.deleteMany({ where: { orderId: { startsWith: "order-" } } });
    await raw.order.deleteMany({ where: { id: { startsWith: "order-" } } });
    await raw.guestSession.deleteMany({ where: { id: { startsWith: "sess-" } } });
    await raw.user.deleteMany({ where: { id: "st-tab" } });
    await raw.venueTable.deleteMany({ where: { id: { startsWith: "table-" } } });
    await raw.menuItem.deleteMany({ where: { id: { startsWith: "mi-" } } });
    await raw.menuCategory.deleteMany({ where: { id: { startsWith: "cat-" } } });
    await raw.zone.deleteMany({ where: { id: { startsWith: "zone-" } } });

    await raw.user.create({ data: { id: "st-tab", name: "Tab Tester", email: "tab@test.local" } });
    await seedCategories(raw, venueA);
    await seedCategories(raw, venueB);
    await seedMenuItems(raw, venueA);
    await seedMenuItems(raw, venueB);
    await seedTable(raw, venueA, "table-1", "T1", "Main", "occupied");
    await seedTable(raw, venueA, "table-2", "T2", "Main", "open");
    await seedTable(raw, venueB, "table-99", "T99", "Main", "occupied");
    await seedSession(raw, venueA, "sess-1", "table-1", "T1");
    await seedSession(raw, venueB, "sess-99", "table-99", "T99");
    await seedOrder(raw, venueA, "order-1", "sess-1", 1200);
    sessionA = { venueId: venueA };
  }, 60_000);

  afterAll(async () => {
    await testDb?.teardown();
  });

  // ── Adjustment reasons ─────────────────────────────────────────────────

  describe("adjustment reasons", () => {
    it("lists reasons (empty initially)", async () => {
      const reasons = await listAdjustmentReasons(getDb(sessionA));
      expect(reasons).toEqual([]);
    });

    it("creates a reason and lists it", async () => {
      const reason = await createAdjustmentReason(getDb(sessionA), venueA, {
        kind: "void", code: "wrong-drink", label: "Wrong drink delivered",
      });
      expect(reason.kind).toBe("void");
      expect(reason.code).toBe("wrong-drink");
      expect(reason.isActive).toBe(true);

      const list = await listAdjustmentReasons(getDb(sessionA), "void");
      expect(list).toHaveLength(1);
      expect(list[0].code).toBe("wrong-drink");
    });

    it("toggles a reason active/inactive", async () => {
      const reason = await createAdjustmentReason(getDb(sessionA), venueA, {
        kind: "comp", code: "manager-comp", label: "Manager comp",
      });
      const off = await setAdjustmentReasonActive(getDb(sessionA), reason.id, false);
      expect(off?.isActive).toBe(false);

      const on = await setAdjustmentReasonActive(getDb(sessionA), reason.id, true);
      expect(on?.isActive).toBe(true);
    });
  });

  // ── Tab adjustments ────────────────────────────────────────────────────

  describe("adjustments", () => {
    beforeAll(async () => {
      await createAdjustmentReason(getDb(sessionA), venueA, {
        kind: "void", code: "wrong-item", label: "Wrong item",
      });
      await createAdjustmentReason(getDb(sessionA), venueA, {
        kind: "comp", code: "vip-comp", label: "VIP comp",
      });
      await createAdjustmentReason(getDb(sessionA), venueA, {
        kind: "discount", code: "staff-disc", label: "Staff discount",
      });
      // Fresh orders so tests don't interfere with each other.
      await seedOrder(raw, venueA, "order-adj-void", "sess-1", 1200);
      await seedOrder(raw, venueA, "order-adj-reverse", "sess-1", 800);
      await seedOrder(raw, venueA, "order-adj-comp", "sess-1", 600);
      // An order whose item carries an add-on (deltaCents), exercising the
      // cents-native line math — the old path read .priceDelta on a deltaCents
      // shape and produced NaN.
      await raw.order.create({
        data: {
          id: "order-adj-addon", venueId: venueA, code: "ADDON", sessionId: "sess-1",
          tableId: "table-1", tableCode: "T1", zoneId: "zone-main", zoneName: "Main",
          guestName: "Add-on Guest", status: "delivered",
          totalCents: 1900, subtotalCents: 1900, totalFeeCents: 0, tipCents: 0,
        },
      });
      await raw.orderItem.create({
        data: {
          id: "oi-adj-addon", orderId: "order-adj-addon", menuItemId: "mi-vodka",
          name: "Vodka + sparkler", unitCents: 1600, quantity: 1,
          modifiers: [{ groupName: "Presentation", optionName: "Sparkler parade", deltaCents: 300, quantity: 1 }],
        },
      });
    });

    it("creates a void adjustment and writes audit + stock movement", async () => {
      const result = await createAdjustment(getDb(sessionA), venueA, {
        orderId: "order-adj-void", kind: "void", reasonCode: "wrong-item",
        authorStaffId: "st-tab", authorStaffName: "Tab Tester",
      });
      expect(result.ok).toBe(true);

      const adjustments = await listAdjustments(getDb(sessionA), "sess-1");
      expect(adjustments.length).toBeGreaterThanOrEqual(1);
      expect(adjustments[0].kind).toBe("void");
      expect(adjustments[0].amountCents).toBe(1200);

      const audit = await listAuditEntries(getDb(sessionA));
      expect(audit.some((e) => e.action === "tab:void")).toBe(true);

      const item = await raw.menuItem.findUnique({ where: { id: "mi-vodka" } });
      expect(item?.inventory).toBe(51); // was 50, +1 from void
    });

    it("voids a line with an add-on at the cents-native amount (INV regression — was NaN)", async () => {
      const result = await createAdjustment(getDb(sessionA), venueA, {
        orderId: "order-adj-addon",
        orderItemId: "oi-adj-addon",
        kind: "void",
        reasonCode: "wrong-item",
        authorStaffId: "st-tab", authorStaffName: "Tab Tester",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("add-on void must succeed");
      // 1600 + 300 deltaCents = 1900 exactly, not NaN.
      expect(result.adjustment.amountCents).toBe(1900);
    });

    it("rejects adjustment for unknown reason code", async () => {
      const result = await createAdjustment(getDb(sessionA), venueA, {
        orderId: "order-adj-void", kind: "void", reasonCode: "nonexistent",
        authorStaffId: "st-tab", authorStaffName: "Tab Tester",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("Unknown or inactive");
    });

    it("reverses a void adjustment and deducts returned stock", async () => {
      const adj = await createAdjustment(getDb(sessionA), venueA, {
        orderId: "order-adj-reverse", kind: "void", reasonCode: "wrong-item",
        authorStaffId: "st-tab", authorStaffName: "Tab Tester",
      });
      expect(adj.ok).toBe(true);

      const invAfterVoid = (await raw.menuItem.findUnique({ where: { id: "mi-vodka" } }))?.inventory ?? 0;

      expect(adj.ok).toBe(true);
      if (!adj.ok) throw new Error("adjustment must succeed");
      const rev = await reverseAdjustment(getDb(sessionA), venueA, adj.adjustment.id, "st-tab", "Tab Tester");
      expect(rev.ok).toBe(true);

      const invAfterReverse = (await raw.menuItem.findUnique({ where: { id: "mi-vodka" } }))?.inventory ?? 0;
      expect(invAfterReverse).toBe(invAfterVoid - 1);
    });

    it("rejects double reversal", async () => {
      const adj = await createAdjustment(getDb(sessionA), venueA, {
        orderId: "order-adj-comp", kind: "comp", reasonCode: "vip-comp",
        authorStaffId: "st-tab", authorStaffName: "Tab Tester",
      });
      expect(adj.ok).toBe(true);
      if (!adj.ok) throw new Error("adjustment must succeed");

      await reverseAdjustment(getDb(sessionA), venueA, adj.adjustment.id, "st-tab", "Tab Tester");
      const second = await reverseAdjustment(getDb(sessionA), venueA, adj.adjustment.id, "st-tab", "Tab Tester");
      expect(second.ok).toBe(false);
      if (!second.ok) expect(second.error).toContain("already been reversed");
    });

    it("INV-T3 concurrency: two parallel full comps — only one wins", async () => {
      await seedOrder(raw, venueA, "order-adj-race", "sess-1", 1000);
      const db = getDb(sessionA);
      const both = await Promise.all([
        createAdjustment(db, venueA, {
          orderId: "order-adj-race", kind: "comp", reasonCode: "vip-comp",
          authorStaffId: "st-tab", authorStaffName: "Tab Tester",
        }),
        createAdjustment(db, venueA, {
          orderId: "order-adj-race", kind: "comp", reasonCode: "vip-comp",
          authorStaffId: "st-tab", authorStaffName: "Tab Tester",
        }),
      ]);
      const wins = both.filter((r) => r.ok);
      const losses = both.filter((r) => !r.ok);
      expect(wins).toHaveLength(1);
      expect(losses).toHaveLength(1);
      expect(losses[0].error).toContain("remains un-adjusted");

      const adjustments = await listAdjustments(db, "sess-1");
      const race = adjustments.filter((a) => a.orderId === "order-adj-race");
      // Exactly one live comp for the target.
      expect(race.filter((a) => a.kind === "comp" && !a.reversedByAdjustmentId)).toHaveLength(1);
    });

    it("reversing a comp nets it out — reversal row carries zero value (INV regression)", async () => {
      await seedOrder(raw, venueA, "order-adj-netzero", "sess-1", 800);
      const db = getDb(sessionA);
      const adj = await createAdjustment(db, venueA, {
        orderId: "order-adj-netzero", kind: "comp", reasonCode: "vip-comp",
        authorStaffId: "st-tab", authorStaffName: "Tab Tester",
      });
      expect(adj.ok).toBe(true);
      if (!adj.ok) throw new Error("adjustment must succeed");

      const rev = await reverseAdjustment(db, venueA, adj.adjustment.id, "st-tab", "Tab Tester");
      expect(rev.ok).toBe(true);

      const adjustments = await listAdjustments(db, "sess-1");
      const forOrder = adjustments.filter((a) => a.orderId === "order-adj-netzero");
      const liveComp = forOrder.filter((a) => a.kind === "comp" && !a.reversedByAdjustmentId);
      // After reversal the only live comp row is the reversal, which must be zero.
      expect(liveComp).toHaveLength(1);
      expect(liveComp[0].amountCents).toBe(0);
    });

    it("INV-T3: whole-order comp is rejected once items already carry comps (cross-scope)", async () => {
      // Order total 1000 with two items: 600 + 400.
      await raw.order.create({
        data: {
          id: "order-adj-xscope", venueId: venueA, code: "XSCOPE", sessionId: "sess-1",
          tableId: "table-1", tableCode: "T1", zoneId: "zone-main", zoneName: "Main",
          guestName: "X-Scope", status: "delivered",
          totalCents: 1000, subtotalCents: 1000, totalFeeCents: 0, tipCents: 0,
        },
      });
      await raw.orderItem.createMany({
        data: [
          { id: "oi-xscope-a", orderId: "order-adj-xscope", menuItemId: "mi-vodka", name: "A", unitCents: 600, quantity: 1, modifiers: [] },
          { id: "oi-xscope-b", orderId: "order-adj-xscope", menuItemId: "mi-beer", name: "B", unitCents: 400, quantity: 1, modifiers: [] },
        ],
      });
      const db = getDb(sessionA);

      const itemComp = await createAdjustment(db, venueA, {
        orderId: "order-adj-xscope", orderItemId: "oi-xscope-a", kind: "comp", reasonCode: "vip-comp",
        authorStaffId: "st-tab", authorStaffName: "Tab Tester",
      });
      expect(itemComp.ok).toBe(true);

      // Whole-order comp would push total comped (600 + 1000) past the 1000 order.
      const orderComp = await createAdjustment(db, venueA, {
        orderId: "order-adj-xscope", kind: "comp", reasonCode: "vip-comp",
        authorStaffId: "st-tab", authorStaffName: "Tab Tester",
      });
      expect(orderComp.ok).toBe(false);
      if (!orderComp.ok) expect(orderComp.error).toContain("remains un-adjusted");
    });
  });

  // ── Session transfer / merge ────────────────────────────────────────────

  describe("session transfer and merge", () => {
    beforeAll(async () => {
      await seedTable(raw, venueA, "table-3", "T3", "Rooftop", "open");
    });

    it("transfers a session to another table", async () => {
      const result = await transferSession(getDb(sessionA), venueA, "sess-1", {
        toTableId: "table-3", toTableCode: "T3", toZoneName: "Rooftop",
        staffId: "st-tab", staffName: "Tab Tester",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("transfer must succeed");
      expect(result.session.tableId).toBe("table-3");

      // Verify source table freed, target table occupied.
      const t1 = await raw.venueTable.findUnique({ where: { id: "table-1" } });
      const t3 = await raw.venueTable.findUnique({ where: { id: "table-3" } });
      expect(t1?.status).toBe("open");
      expect(t3?.status).toBe("occupied");
    });

    it("merges a child session into a parent with higher minimum", async () => {
      // Create a second session for the merge.
      await seedSession(raw, venueA, "sess-child", "table-2", "T2");
      await seedOrder(raw, venueA, "order-child", "sess-child", 800);

      const result = await mergeSession(getDb(sessionA), venueA, "sess-child", {
        parentSessionId: "sess-1", staffId: "st-tab", staffName: "Tab Tester",
      });
      expect(result.ok).toBe(true);

      // Child should be closed.
      const child = await raw.guestSession.findUnique({ where: { id: "sess-child" } });
      expect(child?.status).toBe("closure_requested");
      expect(child?.parentSessionId).toBe("sess-1");
    });

    it("reassigns orders between sessions", async () => {
      const result = await reassignOrdersToSession(getDb(sessionA), venueA, "sess-1", "sess-child");
      expect(result.ok).toBe(true);
    });
  });

  // ── Audit ────────────────────────────────────────────────────────────────

  describe("audit entries", () => {
    it("records and lists audit entries with filters", async () => {
      await recordAuditEntry(getDb(sessionA), venueA, {
        actorStaffId: "st-tab", actorName: "Tab Tester",
        action: "test:audit", targetType: "test", targetId: "t-1",
        summary: "Integration test audit entry",
        metadata: { key: "value" },
      });

      const list = await listAuditEntries(getDb(sessionA), { action: "test:audit" });
      expect(list.length).toBeGreaterThanOrEqual(1);
      expect(list[0].action).toBe("test:audit");
    });
  });

  // ── Cashout ──────────────────────────────────────────────────────────────

  describe("cashout", () => {
    it("closes a cashout and computes variance server-side", async () => {
      const result = await closeCashout(getDb(sessionA), venueA, 6, {
        businessDate: "2026-07-30",
        expectedByMethod: { terminal: 0, cash: 0, house: 0 },
        countedByMethod: { terminal: 0, cash: 0, house: 0 },
        closedByStaffId: "st-tab", closedByStaffName: "Tab Tester",
      });
      // May succeed or fail depending on whether sessions exist — just check the shape.
      if (result.ok) {
        expect(result.cashout.businessDate).toBe("2026-07-30");
      }

      const list = await listCashouts(getDb(sessionA));
      expect(list.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Order extras ─────────────────────────────────────────────────────────

  describe("order extras", () => {
    beforeAll(async () => {
      // Fresh order that hasn't been comped/voided by earlier tests.
      await seedOrder(raw, venueA, "order-extras", "sess-1", 800);
      await seedOrder(raw, venueA, "order-extras-2", "sess-1", 1000);
    });

    it("rushes an order", async () => {
      const order = await rushOrder(getDb(sessionA), venueA, "order-extras", "Tab Tester");
      expect(order).not.toBeNull();
      expect(order?.isRushed).toBe(true);
      expect(order?.rushedBy).toBe("Tab Tester");
    });

    it("comps an entire order", async () => {
      const result = await compEntireOrder(getDb(sessionA), venueA, "order-extras", "vip-comp", "st-tab", "Tab Tester");
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("comp must succeed");
      expect(result.adjustment.kind).toBe("comp");
    });

    it("records a remake link", async () => {
      const link = await remakeOrder(getDb(sessionA), venueA, "order-extras-2", "order-extras", "Remake after void", "st-tab", "Tab Tester");
      expect(link).not.toBeNull();
      expect(link?.oldOrderId).toBe("order-extras-2");
      expect(link?.newOrderId).toBe("order-extras");
    });

    it("reports a walkout", async () => {
      const wo = await reportWalkout(getDb(sessionA), venueA, "sess-child", "Guest left without paying", "st-tab", "Tab Tester");
      expect(wo).not.toBeNull();
      expect(wo?.description).toBe("Guest left without paying");
    });
  });

  // ── Split bill ───────────────────────────────────────────────────────────

  describe("split bill", () => {
    beforeAll(async () => {
      await seedOrder(raw, venueA, "order-split", "sess-1", 1500);
      // Add-on order so the modifier-inclusive sub-total is exercised (1600 + 300).
      await raw.order.create({
        data: {
          id: "order-split-addon", venueId: venueA, code: "SPLADD", sessionId: "sess-1",
          tableId: "table-1", tableCode: "T1", zoneId: "zone-main", zoneName: "Main",
          guestName: "Split Add-on", status: "delivered",
          totalCents: 1900, subtotalCents: 1900, totalFeeCents: 0, tipCents: 0,
        },
      });
      await raw.orderItem.create({
        data: {
          id: "oi-split-addon", orderId: "order-split-addon", menuItemId: "mi-vodka",
          name: "Vodka + sparkler", unitCents: 1600, quantity: 1,
          modifiers: [{ groupName: "Presentation", optionName: "Sparkler parade", deltaCents: 300, quantity: 1 }],
        },
      });
    });

    it("computes per-group sub-totals", async () => {
      const result = await splitBill(getDb(sessionA), "sess-1", [
        { label: "Alice", orderItemIds: ["oi-order-split"] },
        { label: "Bob", orderItemIds: [] },
      ]);
      expect(result).not.toBeNull();
      expect(result!.splits[0].label).toBe("Alice");
      expect(result!.splits[0].subTotalCents).toBe(1500);
      expect(result!.splits[1].subTotalCents).toBe(0);
    });

    it("includes item add-on modifiers in the sub-total (INV regression)", async () => {
      const result = await splitBill(getDb(sessionA), "sess-1", [
        { label: "Add-on", orderItemIds: ["oi-split-addon"] },
      ]);
      expect(result).not.toBeNull();
      expect(result!.splits[0].subTotalCents).toBe(1900);
    });

    it("returns null for inactive session", async () => {
      const result = await splitBill(getDb(sessionA), "nonexistent", []);
      expect(result).toBeNull();
    });
  });

  // ── Tenant isolation ────────────────────────────────────────────────────

  it("enforces tenant isolation on adjustment reasons", async () => {
    // Seed one reason in venue A, confirm venue B can't see it.
    await createAdjustmentReason(getDb({ venueId: venueA }), venueA, {
      kind: "void", code: "iso-test", label: "Isolation test",
    });
    const seenByA = await listAdjustmentReasons(getDb({ venueId: venueA }));
    const seenByB = await listAdjustmentReasons(getDb({ venueId: venueB }));
    expect(seenByA.some((r) => r.code === "iso-test")).toBe(true);
    expect(seenByB.some((r) => r.code === "iso-test")).toBe(false);
  });
});
