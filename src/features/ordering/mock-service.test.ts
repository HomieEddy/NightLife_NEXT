import { describe, it, expect } from "vitest";
import { mockOrdersService } from "./mock-service";
import { mockMenuService } from "@/features/menu/mock-service";
import { mockGuestsService } from "@/features/guests/mock-service";
import { mockPulseService } from "@/features/realtime/pulse-mock-service";
import { mockVenueService } from "@/features/venue/mock-service";
import type { MenuItem } from "@/lib/types";

async function placeOrder(menuItem: MenuItem, sessionId?: string) {
  return mockOrdersService.submitOrder({
    tableId: "tbl-vip-1",
    tableCode: "VIP-01",
    zoneId: "zone-vip",
    zoneName: "VIP Mezzanine",
    guestName: "Test Guest",
    sessionId,
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

describe("session closure ordering wall", () => {
  async function newSession() {
    const session = await mockGuestsService.requestSession({
      tableId: "tbl-vip-1",
      tableCode: "VIP-01",
      zoneName: "VIP Mezzanine",
      displayName: "Wall Tester",
      partySize: 2,
    });
    await mockGuestsService.setSessionStatus(session.id, "approved");
    return session;
  }

  it("accepts orders on an approved session", async () => {
    const session = await newSession();
    const item = await stockedItem();
    const order = await placeOrder(item, session.id);
    expect(order.sessionId).toBe(session.id);
  });

  it("rejects new orders once closure is requested", async () => {
    const session = await newSession();
    await mockGuestsService.requestClosure(session.id);
    const item = await stockedItem();
    await expect(placeOrder(item, session.id)).rejects.toThrow(/being closed/);
  });

  it("rejects new orders on a closed session", async () => {
    const session = await newSession();
    await mockGuestsService.setSessionStatus(session.id, "closed", "terminal");
    const item = await stockedItem();
    await expect(placeOrder(item, session.id)).rejects.toThrow(/closed/);
  });

  it("rejects gifts once closure is requested", async () => {
    const session = await newSession();
    await mockGuestsService.requestClosure(session.id);
    const item = await stockedItem();
    await expect(
      mockOrdersService.sendGift({
        fromTableId: "tbl-vip-1",
        fromTableCode: "VIP-01",
        fromZoneId: "zone-vip",
        fromZoneName: "VIP Mezzanine",
        guestName: "Wall Tester",
        sessionId: session.id,
        items: [{ menuItem: item, quantity: 1 }],
        toTableId: "tbl-mf-1",
        toTableCode: "MF-01",
      }),
    ).rejects.toThrow(/being closed/);
  });

  it("does not deduct stock for a rejected order", async () => {
    const session = await newSession();
    await mockGuestsService.requestClosure(session.id);
    const item = await stockedItem();
    const before = (await mockMenuService.getItem(item.id))!.inventory;
    await expect(placeOrder(item, session.id)).rejects.toThrow();
    expect((await mockMenuService.getItem(item.id))!.inventory).toBe(before);
  });
});

describe("last-call order restrictions (OT-06)", () => {
  async function newSession() {
    const session = await mockGuestsService.requestSession({
      tableId: "tbl-vip-1",
      tableCode: "VIP-01",
      zoneName: "VIP Mezzanine",
      displayName: "Last-Call Tester",
      partySize: 2,
    });
    await mockGuestsService.setSessionStatus(session.id, "approved");
    return session;
  }

  it("rejects orders during last call under block-all policy", { timeout: 15_000 }, async () => {
    await mockVenueService.updateVenue({ lastCallPolicy: "block-all" });
    await mockPulseService.startLastCall("Manager");
    try {
      const session = await newSession();
      const item = await stockedItem();
      await expect(placeOrder(item, session.id)).rejects.toThrow(/last call/i);
    } finally {
      await mockPulseService.endLastCall();
      await mockVenueService.updateVenue({ lastCallPolicy: "allow-last-round" });
    }
  });

  it("allows one final order under allow-last-round, then blocks the next", { timeout: 20_000 }, async () => {
    await mockVenueService.updateVenue({ lastCallPolicy: "allow-last-round" });
    await mockPulseService.startLastCall("Manager");
    try {
      const session = await newSession();
      const item = await stockedItem();
      const order = await placeOrder(item, session.id);
      expect(order.sessionId).toBe(session.id);
      await expect(placeOrder(item, session.id)).rejects.toThrow(/final round/i);
    } finally {
      await mockPulseService.endLastCall();
    }
  });

  it("accepts orders normally when last call is not active", async () => {
    const session = await newSession();
    const item = await stockedItem();
    const order = await placeOrder(item, session.id);
    expect(order.status).toBe("pending");
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
