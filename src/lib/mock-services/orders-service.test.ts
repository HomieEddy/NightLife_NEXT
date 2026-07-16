import { describe, it, expect } from "vitest";
import { mockOrdersService } from "./orders-service";
import { mockMenuService } from "./menu-service";
import type { MenuItem } from "@/lib/types";

async function placeOrder(menuItem: MenuItem) {
  return mockOrdersService.submitOrder({
    tableId: "tbl-vip-1",
    tableCode: "VIP-01",
    zoneId: "zone-vip",
    zoneName: "VIP Mezzanine",
    guestName: "Test Guest",
    lines: [{ lineId: "test-line", menuItem, quantity: 2, modifiers: [] }],
    tip: 10,
  });
}

async function stockedItem(): Promise<MenuItem> {
  const items = await mockMenuService.listItems();
  const item = items.find((i) => i.inventory >= 5 && !i.id.startsWith("pkg-"));
  if (!item) throw new Error("seed data has no stocked item");
  return item;
}

describe("order cancellation", () => {
  it("returns the placement draw-down to stock when a pending order is cancelled", async () => {
    const item = await stockedItem();
    const before = (await mockMenuService.getItem(item.id))!.inventory;

    const order = await placeOrder(item);
    expect((await mockMenuService.getItem(item.id))!.inventory).toBe(before - 2);

    const cancelled = await mockOrdersService.cancelOrder(order.id);
    expect(cancelled?.status).toBe("cancelled");
    expect((await mockMenuService.getItem(item.id))!.inventory).toBe(before);
  });

  it("rejects cancelling a delivered order", async () => {
    const all = await mockOrdersService.listOrders();
    const delivered = all.find((o) => o.status === "delivered");
    expect(delivered).toBeDefined();
    expect(await mockOrdersService.cancelOrder(delivered!.id)).toBeNull();
  });

  it("rejects cancelling an already-cancelled order", async () => {
    const item = await stockedItem();
    const order = await placeOrder(item);
    await mockOrdersService.cancelOrder(order.id);
    expect(await mockOrdersService.cancelOrder(order.id)).toBeNull();
  });

  it("does not double-credit stock on repeated cancel attempts", async () => {
    const item = await stockedItem();
    const before = (await mockMenuService.getItem(item.id))!.inventory;
    const order = await placeOrder(item);
    await mockOrdersService.cancelOrder(order.id);
    await mockOrdersService.cancelOrder(order.id);
    expect((await mockMenuService.getItem(item.id))!.inventory).toBe(before);
  });
});

describe("order claiming", () => {
  it("rejects a claim when another staff already holds the order", async () => {
    const item = await stockedItem();
    const order = await placeOrder(item);
    expect(await mockOrdersService.claimOrder(order.id, "st-a", "Ana")).not.toBeNull();
    expect(await mockOrdersService.claimOrder(order.id, "st-b", "Ben")).toBeNull();
  });

  it("rejects claiming a cancelled order", async () => {
    const item = await stockedItem();
    const order = await placeOrder(item);
    await mockOrdersService.cancelOrder(order.id);
    expect(await mockOrdersService.claimOrder(order.id, "st-a", "Ana")).toBeNull();
  });

  it("rejects claiming a delivered order", async () => {
    const all = await mockOrdersService.listOrders();
    const delivered = all.find((o) => o.status === "delivered");
    expect(delivered).toBeDefined();
    expect(await mockOrdersService.claimOrder(delivered!.id, "st-a", "Ana")).toBeNull();
  });
});

describe("order money math", () => {
  it("stores a service fee rounded to cents", async () => {
    const item = await stockedItem();
    const order = await placeOrder(item);
    expect(order.serviceFee).toBe(Math.round(order.serviceFee * 100) / 100);
    expect(order.total).toBe(Math.round(order.total * 100) / 100);
  });

  it("applies the best active happy-hour rule and stamps attribution", async () => {
    const item = await stockedItem();
    // Always-on window (00:00–00:00 wraps the whole day); 50% beats every seeded rule.
    const rule = await mockMenuService.createHappyHourRule({
      name: "Test All Night",
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      startTime: "00:00",
      endTime: "00:00",
      discountPct: 50,
      appliesToCategoryIds: [item.categoryId],
      isActive: true,
    });

    try {
      const order = await placeOrder(item);
      const lineTotal = item.price * 2;
      const expectedDiscount = Math.round(lineTotal * 50) / 100;
      expect(order.happyHourRuleId).toBe(rule.id);
      expect(order.happyHourCents).toBe(Math.round(expectedDiscount * 100));
      expect(order.total).toBe(
        Math.round((order.subtotal - expectedDiscount + order.serviceFee + order.tip) * 100) / 100,
      );
    } finally {
      await mockMenuService.deleteHappyHourRule(rule.id);
    }
  });

  it("stamps no happy-hour attribution when no rule covers the order", async () => {
    const rules = await mockMenuService.listHappyHourRules();
    // Deactivate everything so the seeded windows can't fire regardless of wall clock.
    const active = rules.filter((r) => r.isActive);
    for (const r of active) await mockMenuService.toggleHappyHourRule(r.id);

    try {
      const item = await stockedItem();
      const order = await placeOrder(item);
      expect(order.happyHourRuleId).toBeUndefined();
      expect(order.happyHourCents).toBeUndefined();
    } finally {
      for (const r of active) await mockMenuService.toggleHappyHourRule(r.id);
    }
  });
});
