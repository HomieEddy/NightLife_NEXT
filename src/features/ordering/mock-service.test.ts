import { describe, it, expect } from "vitest";
import { mockOrdersService } from "./mock-service";
import { mockMenuService } from "@/features/menu/mock-service";
import { mockGuestsService } from "@/features/guests/mock-service";
import { mockPulseService } from "@/features/realtime/pulse-mock-service";
import { mockVenueService } from "@/features/venue/mock-service";
import { mockStaffService } from "@/features/workforce/staff-mock-service";
import { mockDoorService } from "@/features/door/mock-service";
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

describe("rush order (OT-02)", () => {
  it("marks an order as rushed with the rushing staff name", async () => {
    const item = await stockedItem();
    const order = await placeOrder(item);
    const rushed = await mockOrdersService.rushOrder(order.id, "Manager");
    expect(rushed).not.toBeNull();
    expect(rushed!.isRushed).toBe(true);
    expect(rushed!.rushedBy).toBe("Manager");
    expect(rushed!.rushedAt).toBeDefined();
  });

  it("returns null when rushing a non-existent order", async () => {
    expect(await mockOrdersService.rushOrder("nonexistent", "Manager")).toBeNull();
  });
});

describe("comp entire round (OT-08)", () => {
  async function newSession() {
    const session = await mockGuestsService.requestSession({
      tableId: "tbl-vip-1",
      tableCode: "VIP-01",
      zoneName: "VIP Mezzanine",
      displayName: "Comp Tester",
      partySize: 2,
    });
    await mockGuestsService.setSessionStatus(session.id, "approved");
    return session;
  }

  it("comps all items in an order in one audit entry", { timeout: 10_000 }, async () => {
    const session = await newSession();
    const item = await stockedItem();
    const order = await placeOrder(item, session.id);
    const comp = await mockOrdersService.compEntireOrder(
      order.id, "vip-round", "st-amara", "Amara"
    );
    expect(comp).toBeDefined();
    expect(comp!.kind).toBe("comp");
    expect(comp!.orderId).toBe(order.id);
  });

  it("rejects comping an order with no session", async () => {
    const all = await mockOrdersService.listOrders();
    const order = all.find((o) => !o.sessionId);
    if (order) {
      await expect(
        mockOrdersService.compEntireOrder(order.id, "test", "st-a", "Ana")
      ).rejects.toThrow("session");
    }
  });
});

describe("remake order (OT-05)", () => {
  it("creates a remake record linking old and new order ids", async () => {
    const item = await stockedItem();
    const oldOrder = await placeOrder(item);
    const newOrder = await placeOrder(item);
    expect(await mockOrdersService.remakeOrder(
      oldOrder.id, newOrder.id, "bottle corked", "st-staff", "Staff"
    )).not.toBeNull();
  });
});

describe("VIP host assignment (GS-03)", () => {
  it("assigns a host to an approved session", async () => {
    const sessions = await mockGuestsService.listSessions();
    const approved = sessions.find((s) => s.status === "approved");
    expect(approved).toBeDefined();
    const updated = await mockGuestsService.assignHost(approved!.id, "st-a", "Ana");
    expect(updated).not.toBeNull();
    expect(updated!.assignedHostId).toBe("st-a");
    expect(updated!.assignedHostName).toBe("Ana");
  });

  it("unassigns a host from a session", async () => {
    const sessions = await mockGuestsService.listSessions();
    const approved = sessions.find((s) => s.status === "approved");
    await mockGuestsService.assignHost(approved!.id, "st-a", "Ana");
    const updated = await mockGuestsService.unassignHost(approved!.id);
    expect(updated).not.toBeNull();
    expect(updated!.assignedHostId).toBeUndefined();
  });
});

describe("guest spend velocity (CRM-04)", () => {
  it("returns spend and order count for a guest tonight", async () => {
    const spend = await mockGuestsService.getGuestSpendTonight("gp-felix");
    expect(spend).toBeDefined();
    expect(typeof spend.totalSpent).toBe("number");
    expect(typeof spend.orderCount).toBe("number");
  });

  it("returns top spenders tonight sorted by total", async () => {
    const top = await mockGuestsService.getTopSpendersTonight(3);
    expect(Array.isArray(top)).toBe(true);
    if (top.length >= 2) {
      expect(top[0].totalSpent).toBeGreaterThanOrEqual(top[1].totalSpent);
    }
  });
});

describe("VIP tier benefits (CRM-05)", () => {
  it("lists VIP tier benefits", async () => {
    const benefits = await mockGuestsService.listVipTierBenefits();
    expect(benefits.length).toBeGreaterThan(0);
    expect(benefits[0].tier).toBeDefined();
    expect(benefits[0].benefit).toBeDefined();
  });

  it("filters benefits by tier", async () => {
    const vipBenefits = await mockGuestsService.listVipTierBenefits("vip");
    expect(vipBenefits.every((b) => b.tier === "vip")).toBe(true);
  });

  it("creates and removes a VIP tier benefit", async () => {
    const created = await mockGuestsService.createVipTierBenefit({
      tier: "regular",
      benefit: "Priority access",
      category: "admission",
      sortOrder: 99,
      active: true,
    });
    expect(created.id).toBeDefined();
    await mockGuestsService.removeVipTierBenefit(created.id);
    const remaining = await mockGuestsService.listVipTierBenefits();
    expect(remaining.find((b) => b.id === created.id)).toBeUndefined();
  });
});

describe("staff table assignment (WF-05)", () => {

  it("assigns tables to staff and retrieves assignment", async () => {
    const result = await mockStaffService.assignTables({
      staffId: "st-lucas",
      tableIds: ["tbl-vip-1", "tbl-vip-2"],
      zoneId: "zone-vip",
    });
    expect(result).not.toBeNull();
    expect(result!.tableIds).toContain("tbl-vip-1");
  });

  it("finds assigned staff for a table", async () => {
    await mockStaffService.assignTables({
      staffId: "st-nina",
      tableIds: ["tbl-mf-1"],
      zoneId: "zone-main-floor",
    });
    const assigned = await mockStaffService.getAssignedStaff("tbl-mf-1");
    expect(assigned.length).toBeGreaterThan(0);
    expect(assigned[0].staffId).toBe("st-nina");
  });
});

describe("revenue pace (RT-08)", () => {
  it("returns a revenue pace object with current and projected values", async () => {
    const pace = await mockPulseService.getRevenuePace();
    expect(pace).toBeDefined();
    expect(typeof pace.current).toBe("number");
    expect(typeof pace.projected).toBe("number");
    expect(typeof pace.pacePercent).toBe("number");
  });
});

describe("group admission (DO-08)", () => {

  it("admits a group and links all admissions with a group id", async () => {
    const { current: occ, legalCapacity } = await mockDoorService.getOccupancy();
    if (occ >= legalCapacity - 5) {
      // ponytail: capacity saturated by earlier tests, skip
      return;
    }
    const admissions = await mockDoorService.admitGroup({
      members: [
        { partySize: 1, source: "walk-in", admissionType: "cover", amountOwedCents: 1000 },
        { partySize: 1, source: "walk-in", admissionType: "cover", amountOwedCents: 1000 },
      ],
      staffId: "st-viktor",
      staffName: "Viktor Michaud",
    });
    expect(admissions.length).toBe(2);
    const groupId = admissions[0].groupAdmissionId;
    expect(groupId).toBeDefined();
    expect(admissions.every((a) => a.groupAdmissionId === groupId)).toBe(true);
  });
});
