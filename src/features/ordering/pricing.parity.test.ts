import { describe, it, expect } from "vitest";
import {
  computeCartPricing,
  computeFeeLinesForSubtotal,
  computeOrderPricing,
  computeServiceFeeForSubtotal,
} from "./pricing";
import { mockMenuItems } from "@/features/menu/mock-data";
import { mockVenue } from "@/features/venue/mock-data";
import type { CartLine, HappyHourRule, Promotion } from "@/lib/types";

/** Deterministic: covers the whole run day so the fixture never falls outside its window. */
function allDayRule(patch: Partial<HappyHourRule> = {}): HappyHourRule {
  const now = new Date();
  return {
    id: "hh-parity",
    venueId: "venue-1",
    name: "HH",
    daysOfWeek: [now.getDay()],
    startTime: "00:00",
    endTime: "24:00",
    discountPct: 20,
    appliesToCategoryIds: ["cat-vodka", "cat-gin"],
    isActive: true,
    ...patch,
  };
}

const promo = (patch: Partial<Promotion>): Promotion => ({
  id: "p1",
  venueId: "venue-1",
  code: "TEST",
  name: "Test promo",
  type: "percentage",
  value: 10,
  appliesToCategoryIds: [],
  startsAt: "2026-01-01T00:00:00.000Z",
  endsAt: "2030-01-01T00:00:00.000Z",
  status: "active",
  redemptionCount: 0,
  ...patch,
});

/** Cart: 2× Tito's + sparkler mod (385.00), 1× Dom (320.00), 1× Hendrick's (210.00), 4× Coke (16.00). */
function fixtureCart(): CartLine[] {
  const titos = mockMenuItems.find((m) => m.id === "mi-titos");
  const dom = mockMenuItems.find((m) => m.id === "mi-dom");
  const hendricks = mockMenuItems.find((m) => m.id === "mi-hendricks");
  const coke = mockMenuItems.find((m) => m.id === "mi-coke");
  if (!titos || !dom || !hendricks || !coke) throw new Error("mock menu fixture missing items");
  return [
    {
      lineId: "l1",
      menuItem: titos,
      quantity: 2,
      modifiers: [
        {
          groupId: "mod-presentation",
          optionId: "pr-2",
          kind: "presentation",
          groupName: "Presentation",
          optionName: "Sparkler parade",
          priceDelta: 25,
          quantity: 1,
        },
      ],
    },
    { lineId: "l2", menuItem: dom, quantity: 1, modifiers: [] },
    { lineId: "l3", menuItem: hendricks, quantity: 1, modifiers: [] },
    { lineId: "l4", menuItem: coke, quantity: 4, modifiers: [] },
  ];
}

describe("pricing parity — demo dollars adapter ≡ live cents engine", () => {
  const now = new Date();

  it("produces the exact same cents through both interfaces, including modifiers and category-scoped rules", () => {
    const lines = fixtureCart();
    const promotion = promo({ value: 10 });

    const demo = computeCartPricing({
      lines,
      venue: mockVenue,
      happyHourRules: [allDayRule()],
      promotion,
      tip: 40.66,
      now,
    });

    const live = computeOrderPricing({
      lines: lines.map((line) => ({
        menuItemId: line.menuItem.id,
        name: line.menuItem.name,
        priceCents: Math.round(line.menuItem.price * 100),
        quantity: line.quantity,
        categoryId: line.menuItem.categoryId,
        modifiers: line.modifiers.map((modifier) => ({
          groupName: modifier.groupName,
          optionName: modifier.optionName,
          deltaCents: Math.round(modifier.priceDelta * 100),
          quantity: modifier.quantity,
        })),
      })),
      fees: mockVenue.serviceFees.map((fee) =>
        fee.type === "flat"
          ? { id: fee.id, name: fee.name, type: "flat", valueCents: Math.round(fee.value * 100) }
          : { id: fee.id, name: fee.name, type: "percentage", value: Math.round(fee.value * 100) },
      ),
      happyHourRules: [allDayRule()],
      promotion: { type: "percentage", value: 10, appliesToCategoryIds: [] },
      tipCents: Math.round(40.66 * 100),
      now,
    });

    expect(demo.totalCents).toBe(live.totalCents);
    expect(demo.totalCents).toBe(91747);
    expect(demo.subtotal).toBe(931);
    expect(demo.happyHourDiscount).toBe(119);
    expect(demo.promoDiscount).toBe(81.2);
    expect(demo.feeLines.map((l) => l.amount)).toEqual([36.54, 36.54, 72.93]);
    expect(demo.total).toBe(917.47);
  });

  it("applies flat fees even when discounts zero the subtotal (live semantics, not the old dollars path)", () => {
    const venue = {
      ...mockVenue,
      serviceFees: [{ id: "cover", name: "Cover", type: "flat" as const, value: 10 }],
    };
    const coke = mockMenuItems.find((m) => m.id === "mi-coke");
    if (!coke) throw new Error("missing fixture item");

    const result = computeCartPricing({
      lines: [{ lineId: "l1", menuItem: coke, quantity: 1, modifiers: [] }],
      venue,
      happyHourRules: [],
      promotion: promo({ type: "flat", value: 50 }),
      tip: 0,
      now,
    });

    expect(result.afterDiscounts).toBe(0);
    expect(result.serviceFee).toBe(10); // old computeFeeLines returned [] here
    expect(result.total).toBe(10);
  });

  it("caps a flat promo at the after-happy-hour amount, not the raw subtotal", () => {
    const dom = mockMenuItems.find((m) => m.id === "mi-dom");
    if (!dom) throw new Error("missing fixture item");

    const result = computeCartPricing({
      lines: [{ lineId: "l1", menuItem: dom, quantity: 1, modifiers: [] }],
      venue: mockVenue,
      happyHourRules: [allDayRule({ appliesToCategoryIds: ["cat-champagne"], discountPct: 20 })],
      promotion: promo({ type: "flat", value: 300 }), // raw subtotal: 320.00
      tip: 0,
      now,
    });

    expect(result.happyHourDiscount).toBe(64);
    expect(result.promoDiscount).toBe(256); // cap at 320 − 64, not at 320
    expect(result.afterDiscounts).toBe(0);
  });

  it("honors category-scoped percentage promos", () => {
    const lines = fixtureCart();
    const result = computeCartPricing({
      lines,
      venue: mockVenue,
      happyHourRules: [allDayRule()],
      promotion: promo({ type: "percentage", value: 25, appliesToCategoryIds: ["cat-champagne"] }),
      tip: 0,
      now,
    });

    expect(result.promoDiscount).toBe(80); // 25% of the Champagne line only
  });

  it("fee-only facade matches the engine's fee semantics for a subtotal", () => {
    const lines = computeFeeLinesForSubtotal(200, mockVenue);
    expect(lines.map((l) => l.amount)).toEqual([10, 10, 19.96]); // 9.975% → 998 bp
    expect(computeServiceFeeForSubtotal(200, mockVenue)).toBe(39.96);
  });
});
