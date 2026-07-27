import { describe, it, expect } from "vitest";
import {
  businessDateFor,
  computeCashoutExpected,
  computeCashoutVariance,
  computeSessionBalance,
  isAdjustmentAmountValid,
  mergedMinimumSpendCents,
  orderItemAmountCents,
  orderItemPartialAmountCents,
  orderTotalCents,
  remainingAdjustableCents,
  shortfallRatio,
} from "./tab";
import type { Order, OrderItem, TabAdjustment } from "./types";

function order(patch: Partial<Order> = {}): Order {
  return {
    id: "ord-1",
    code: "A-001",
    venueId: "venue-1",
    sessionId: "gs-1",
    tableId: "t-1",
    tableCode: "VIP-01",
    zoneId: "zone-vip",
    zoneName: "VIP",
    guestName: "Chloé",
    items: [],
    subtotal: 100,
    serviceFee: 0,
    tip: 0,
    total: 100,
    status: "delivered",
    placedAt: "2026-07-25T23:00:00.000Z",
    updatedAt: "2026-07-25T23:00:00.000Z",
    ...patch,
  };
}

function adjustment(patch: Partial<TabAdjustment> = {}): TabAdjustment {
  return {
    id: "adj-1",
    venueId: "venue-1",
    sessionId: "gs-1",
    kind: "comp",
    amountCents: 1000,
    reasonCode: "service-recovery",
    authorStaffId: "staff-1",
    authorStaffName: "Nina",
    createdAt: "2026-07-26T00:00:00.000Z",
    ...patch,
  };
}

function orderItem(patch: Partial<OrderItem> = {}): OrderItem {
  return {
    id: "oi-1",
    menuItemId: "mi-1",
    name: "Grey Goose 750ml",
    quantity: 1,
    unitPrice: 180,
    modifiers: [],
    ...patch,
  };
}

describe("computeSessionBalance", () => {
  it("nets gross against mixed void/comp/discount adjustments (INV-T1)", () => {
    const orders = [order({ total: 500 }), order({ id: "ord-2", total: 300 })];
    const adjustments = [
      adjustment({ kind: "void", amountCents: 18000 }),
      adjustment({ kind: "comp", amountCents: 5000 }),
      adjustment({ kind: "discount", amountCents: 2000 }),
    ];
    const balance = computeSessionBalance("gs-1", orders, adjustments, 0);
    expect(balance.grossCents).toBe(80000);
    expect(balance.adjustmentsCents).toBe(25000);
    expect(balance.netCents).toBe(55000);
    expect(balance.netCents).toBe(balance.grossCents - balance.adjustmentsCents);
  });

  it("excludes cancelled orders from gross — they never entered revenue", () => {
    const orders = [order({ total: 500 }), order({ id: "ord-2", total: 300, status: "cancelled" })];
    const balance = computeSessionBalance("gs-1", orders, [], 0);
    expect(balance.grossCents).toBe(50000);
  });

  it("ignores a reversed adjustment row (superseded, not deleted)", () => {
    const orders = [order({ total: 500 })];
    const adjustments = [
      adjustment({ id: "adj-orig", kind: "comp", amountCents: 5000, reversedByAdjustmentId: "adj-reversal" }),
      adjustment({ id: "adj-reversal", kind: "comp", amountCents: 0 }),
    ];
    const balance = computeSessionBalance("gs-1", orders, adjustments, 0);
    expect(balance.compCents).toBe(0);
    expect(balance.netCents).toBe(50000);
  });

  it("shortfall is exactly zero when net equals the minimum", () => {
    const orders = [order({ total: 800 })];
    const balance = computeSessionBalance("gs-1", orders, [], 80000);
    expect(balance.netCents).toBe(80000);
    expect(balance.shortfallCents).toBe(0);
    expect(balance.settledCents).toBe(80000);
  });

  it("shortfall floors at zero once net exceeds the minimum", () => {
    const orders = [order({ total: 1000 })];
    const balance = computeSessionBalance("gs-1", orders, [], 80000);
    expect(balance.shortfallCents).toBe(0);
  });

  it("reports a positive shortfall below the minimum", () => {
    const orders = [order({ total: 500 })];
    const balance = computeSessionBalance("gs-1", orders, [], 80000);
    expect(balance.shortfallCents).toBe(30000);
    expect(balance.settledCents).toBe(80000); // shortfall line makes the tab close at the commitment
  });
});

describe("void vs comp vs discount — distinct buckets", () => {
  it("keeps void, comp and discount in separate accumulators", () => {
    const orders = [order({ total: 1000 })];
    const adjustments = [
      adjustment({ kind: "void", amountCents: 3000 }),
      adjustment({ kind: "comp", amountCents: 2000 }),
      adjustment({ kind: "discount", amountCents: 1000 }),
    ];
    const balance = computeSessionBalance("gs-1", orders, adjustments, 0);
    expect(balance.voidCents).toBe(3000);
    expect(balance.compCents).toBe(2000);
    expect(balance.discountCents).toBe(1000);
    // discount reduces net by the delta only, same accounting as void/comp for netCents
    expect(balance.netCents).toBe(100000 - 6000);
  });
});

describe("orderItemPartialAmountCents", () => {
  it("prices a partial-quantity void of a line with add-ons correctly (INV-O5)", () => {
    // 3 bottles at $180 + a $30 washer add-on for the whole line ($570 total).
    const item = orderItem({
      quantity: 3,
      unitPrice: 180,
      modifiers: [{ groupId: "g1", optionId: "o1", kind: "washer", groupName: "Washer", optionName: "Red Bull", priceDelta: 30, quantity: 1 }],
    });
    expect(orderItemAmountCents(item)).toBe(57000); // (180*3 + 30) * 100
    // Voiding 1 of 3 units takes a proportional (1/3) share of the whole line, add-ons included.
    expect(orderItemPartialAmountCents(item, 1)).toBe(19000); // round(57000/3)
    expect(orderItemPartialAmountCents(item, 3)).toBe(57000);
    expect(orderItemPartialAmountCents(item, 0)).toBe(0);
  });

  it("clamps a requested quantity above the line's own quantity", () => {
    const item = orderItem({ quantity: 2, unitPrice: 50 });
    expect(orderItemPartialAmountCents(item, 5)).toBe(orderItemAmountCents(item));
  });
});

describe("isAdjustmentAmountValid (INV-T3 — no over-comping)", () => {
  it("accepts an amount within the remaining un-adjusted balance", () => {
    expect(isAdjustmentAmountValid(5000, 18000, [])).toBe(true);
  });

  it("rejects an amount exceeding what's left after a prior adjustment", () => {
    const prior = [adjustment({ kind: "comp", amountCents: 15000 })];
    expect(isAdjustmentAmountValid(5000, 18000, prior)).toBe(false); // only 3000 left
    expect(isAdjustmentAmountValid(3000, 18000, prior)).toBe(true);
  });

  it("rejects a zero or negative amount", () => {
    expect(isAdjustmentAmountValid(0, 18000, [])).toBe(false);
    expect(isAdjustmentAmountValid(-100, 18000, [])).toBe(false);
  });

  it("ignores a reversed prior adjustment when computing remaining room", () => {
    const prior = [adjustment({ kind: "comp", amountCents: 15000, reversedByAdjustmentId: "adj-r" })];
    expect(remainingAdjustableCents(18000, prior)).toBe(18000);
  });
});

describe("mergedMinimumSpendCents", () => {
  it("takes the higher of the two minimums, either order", () => {
    expect(mergedMinimumSpendCents(80000, 60000)).toBe(80000);
    expect(mergedMinimumSpendCents(60000, 80000)).toBe(80000);
    expect(mergedMinimumSpendCents(0, 60000)).toBe(60000);
  });
});

describe("businessDateFor — nightEndHour bucketing", () => {
  it("buckets an after-midnight close to the calendar day the night started", () => {
    // Saturday 2026-07-25 22:00 local, and Sunday 2026-07-26 03:00 local — same business night.
    const start = new Date(2026, 6, 25, 22, 0).toISOString();
    const close = new Date(2026, 6, 26, 3, 0).toISOString();
    expect(businessDateFor(start, 10)).toBe(businessDateFor(close, 10));
  });

  it("rolls to the next business date once past nightEndHour", () => {
    const morning = new Date(2026, 6, 26, 12, 0).toISOString();
    const lateNight = new Date(2026, 6, 25, 22, 0).toISOString();
    expect(businessDateFor(morning, 10)).not.toBe(businessDateFor(lateNight, 10));
  });
});

describe("cash-out expected & variance", () => {
  const nightEndHour = 10;
  const businessDate = businessDateFor(new Date(2026, 6, 25, 23, 0).toISOString(), nightEndHour);

  it("sums settled sessions by method for one business date", () => {
    const sessions = [
      { id: "gs-1", status: "closed", settlementMethod: "cash" as const, settledExternallyAt: new Date(2026, 6, 26, 2, 0).toISOString(), minimumSpendCents: 0 },
      { id: "gs-2", status: "closed", settlementMethod: "terminal" as const, settledExternallyAt: new Date(2026, 6, 26, 3, 0).toISOString(), minimumSpendCents: 0 },
      // Different business date — excluded.
      { id: "gs-3", status: "closed", settlementMethod: "cash" as const, settledExternallyAt: new Date(2026, 6, 27, 2, 0).toISOString(), minimumSpendCents: 0 },
    ];
    const orders = [
      order({ id: "o1", sessionId: "gs-1", total: 500 }),
      order({ id: "o2", sessionId: "gs-2", total: 300 }),
      order({ id: "o3", sessionId: "gs-3", total: 900 }),
    ];
    const expected = computeCashoutExpected(sessions, orders, [], businessDate, nightEndHour);
    expect(expected.cash).toBe(50000);
    expect(expected.terminal).toBe(30000);
    expect(expected.house).toBe(0);
  });

  it("computes a negative variance when the counted till is short", () => {
    const expected = { terminal: 30000, cash: 50000, house: 0 };
    const counted = { terminal: 30000, cash: 48000, house: 0 };
    expect(computeCashoutVariance(expected, counted)).toBe(-2000);
  });

  it("computes a positive variance when the counted till is over", () => {
    const expected = { terminal: 30000, cash: 50000, house: 0 };
    const counted = { terminal: 30000, cash: 50500, house: 0 };
    expect(computeCashoutVariance(expected, counted)).toBe(500);
  });
});

describe("shortfallRatio", () => {
  it("is zero when there's no minimum commitment", () => {
    const balance = computeSessionBalance("gs-1", [order({ total: 100 })], [], 0);
    expect(shortfallRatio(balance)).toBe(0);
  });

  it("scales with how far under the minimum the tab sits", () => {
    const balance = computeSessionBalance("gs-1", [order({ total: 400 })], [], 80000);
    expect(shortfallRatio(balance)).toBeCloseTo(0.5);
  });
});

describe("orderTotalCents", () => {
  it("rounds a dollar total to integer cents once", () => {
    expect(orderTotalCents(order({ total: 123.456 }))).toBe(12346);
  });
});
