import { describe, expect, it } from "vitest";
import { evenShares, summarizeReceipt } from "./receipt";
import type { Order } from "./types";

describe("evenShares", () => {
  it("splits into whole cents that sum exactly to the total", () => {
    const shares = evenShares(100, 3);
    expect(shares).toEqual([33.34, 33.33, 33.33]);
    expect(Math.round(shares.reduce((s, x) => s + x, 0) * 100)).toBe(10000);
  });

  it("handles a total already divisible", () => {
    expect(evenShares(50, 2)).toEqual([25, 25]);
  });
});

function order(partial: Partial<Order>): Order {
  return {
    subtotal: 0,
    tip: 0,
    total: 0,
    ...partial,
  } as Order;
}

describe("summarizeReceipt", () => {
  it("sums totals and promo cents across orders", () => {
    const summary = summarizeReceipt([
      order({ subtotal: 100, tip: 15, total: 120, promotionCents: 500 }),
      order({ subtotal: 50, tip: 5, total: 58 }),
    ]);
    expect(summary.subtotal).toBe(150);
    expect(summary.tip).toBe(20);
    expect(summary.total).toBe(178);
    expect(summary.promoCents).toBe(500);
  });

  it("merges fee lines by fee id across orders", () => {
    const fee = { id: "fee-1", name: "Service", type: "percentage" as const, value: 5 };
    const summary = summarizeReceipt([
      order({ feeBreakdown: [{ fee, amount: 5 }] } as Partial<Order>),
      order({ feeBreakdown: [{ fee, amount: 2.5 }] } as Partial<Order>),
    ]);
    expect(summary.feeLines).toEqual([
      { name: "Service", type: "percentage", value: 5, amount: 7.5 },
    ]);
  });
});
