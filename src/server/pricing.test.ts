import { describe, it, expect } from "vitest";
import { computeOrderPricing, type PricingInput } from "./pricing";

// ── Helpers ───────────────────────────────────────────────────────────

function simpleLine(priceCents: number, quantity: number, categoryId = "cat-1"): PricingInput["lines"][number] {
  return { menuItemId: "item-1", name: "Test Item", priceCents, quantity, categoryId, modifiers: [] };
}

function withModifiers(
  priceCents: number,
  quantity: number,
  modifiers: { groupName: string; optionName: string; deltaCents: number }[],
  categoryId = "cat-1",
): PricingInput["lines"][number] {
  return { menuItemId: "item-2", name: "Modded Item", priceCents, quantity, categoryId, modifiers };
}

const NO_FEES: PricingInput["fees"] = [];
const NO_HAPPY_HOUR: PricingInput["happyHourRules"] = [];

// ── Basic pricing ─────────────────────────────────────────────────────

describe("pricing engine — basics", () => {
  it("computes subtotal from line prices × quantities", () => {
    const result = computeOrderPricing({
      lines: [simpleLine(5000, 2), simpleLine(3000, 1)],
      fees: NO_FEES,
      happyHourRules: NO_HAPPY_HOUR,
      tipCents: 0,
      now: new Date("2026-07-10T23:00:00"),
    });
    expect(result.subtotalCents).toBe(13000);
  });

  it("includes modifier deltas in line subtotal", () => {
    const result = computeOrderPricing({
      lines: [
        withModifiers(5000, 2, [
          { groupName: "Size", optionName: "Large", deltaCents: 500 },
          { groupName: "Ice", optionName: "Extra", deltaCents: 200 },
        ]),
      ],
      fees: NO_FEES,
      happyHourRules: NO_HAPPY_HOUR,
      tipCents: 0,
      now: new Date("2026-07-10T23:00:00"),
    });
    // (5000 + 500 + 200) × 2 = 11400
    expect(result.subtotalCents).toBe(11400);
  });

  it("empty cart returns all zeros", () => {
    const result = computeOrderPricing({
      lines: [],
      fees: [{ id: "f1", name: "Service", type: "percentage", value: 500 }],
      happyHourRules: NO_HAPPY_HOUR,
      tipCents: 500,
      now: new Date("2026-07-10T23:00:00"),
    });
    expect(result.subtotalCents).toBe(0);
    expect(result.totalFeeCents).toBe(0);
    expect(result.tipCents).toBe(0);
    expect(result.totalCents).toBe(0);
    expect(result.feeLines).toEqual([]);
  });
});

// ── Fee stacks ────────────────────────────────────────────────────────

describe("pricing engine — fees", () => {
  it("applies a percentage fee", () => {
    const result = computeOrderPricing({
      lines: [simpleLine(10000, 1)],
      fees: [{ id: "f1", name: "Service", type: "percentage", value: 500 }],
      happyHourRules: NO_HAPPY_HOUR,
      tipCents: 0,
      now: new Date("2026-07-10T23:00:00"),
    });
    // 5% of 10000 = 500
    expect(result.feeLines).toEqual([{ feeId: "f1", feeName: "Service", feeType: "percentage", feeValue: 500, amountCents: 500 }]);
    expect(result.totalFeeCents).toBe(500);
  });

  it("applies a flat fee", () => {
    const result = computeOrderPricing({
      lines: [simpleLine(10000, 1)],
      fees: [{ id: "f2", name: "Delivery", type: "flat", valueCents: 300 }],
      happyHourRules: NO_HAPPY_HOUR,
      tipCents: 0,
      now: new Date("2026-07-10T23:00:00"),
    });
    expect(result.feeLines).toEqual([{ feeId: "f2", feeName: "Delivery", feeType: "flat", feeValue: 300, amountCents: 300 }]);
    expect(result.totalFeeCents).toBe(300);
  });

  it("stacks flat + percentage fees (Montréal TPS+TVQ scenario)", () => {
    // TPS 5%, TVQ 9.975%, flat $2 cover
    const result = computeOrderPricing({
      lines: [simpleLine(36100, 1)], // $361.00
      fees: [
        { id: "tps", name: "TPS", type: "percentage", value: 500 },
        { id: "tvq", name: "TVQ", type: "percentage", value: 998 },
        { id: "cover", name: "Cover", type: "flat", valueCents: 200 },
      ],
      happyHourRules: NO_HAPPY_HOUR,
      tipCents: 0,
      now: new Date("2026-07-10T23:00:00"),
    });
    // TPS: round(36100 * 500 / 10000) = round(1805) = 1805
    // TVQ: round(36100 * 998 / 10000) = round(3602.78) = 3603
    // Cover: 200
    expect(result.feeLines[0].amountCents).toBe(1805);
    expect(result.feeLines[1].amountCents).toBe(3603);
    expect(result.feeLines[2].amountCents).toBe(200);
    expect(result.totalFeeCents).toBe(1805 + 3603 + 200);
  });

  it("3-decimal TVQ percentage rounds correctly", () => {
    // TVQ at 9.975% = value 998 (basis points, rounded to nearest)
    // Actually let's use 9975 tenths-of-basis-point? No — the plan says
    // percentages are in hundredths (basis points * 100). Let's define:
    // value for percentage = percent * 100, so 5% = 500, 9.975% = 998 (rounded)
    // On $100.00 (10000 cents): round(10000 * 998 / 10000) = 998
    const result = computeOrderPricing({
      lines: [simpleLine(10000, 1)],
      fees: [{ id: "tvq", name: "TVQ", type: "percentage", value: 998 }],
      happyHourRules: NO_HAPPY_HOUR,
      tipCents: 0,
      now: new Date("2026-07-10T23:00:00"),
    });
    expect(result.feeLines[0].amountCents).toBe(998);
  });

  it("fees on empty subtotal are zero (flat fees skip)", () => {
    const result = computeOrderPricing({
      lines: [],
      fees: [
        { id: "f1", name: "Service", type: "percentage", value: 500 },
        { id: "f2", name: "Cover", type: "flat", valueCents: 200 },
      ],
      happyHourRules: NO_HAPPY_HOUR,
      tipCents: 0,
      now: new Date("2026-07-10T23:00:00"),
    });
    expect(result.feeLines).toEqual([]);
    expect(result.totalFeeCents).toBe(0);
  });
});

// ── Tip ───────────────────────────────────────────────────────────────

describe("pricing engine — tip", () => {
  it("passes tip through as-is", () => {
    const result = computeOrderPricing({
      lines: [simpleLine(10000, 1)],
      fees: NO_FEES,
      happyHourRules: NO_HAPPY_HOUR,
      tipCents: 1500,
      now: new Date("2026-07-10T23:00:00"),
    });
    expect(result.tipCents).toBe(1500);
  });

  it("tip of zero is valid", () => {
    const result = computeOrderPricing({
      lines: [simpleLine(10000, 1)],
      fees: NO_FEES,
      happyHourRules: NO_HAPPY_HOUR,
      tipCents: 0,
      now: new Date("2026-07-10T23:00:00"),
    });
    expect(result.tipCents).toBe(0);
  });
});

// ── Happy hour ────────────────────────────────────────────────────────

describe("pricing engine — happy hour", () => {
  const fridayNight = new Date("2026-07-10T23:00:00"); // Friday = day 5

  it("applies discount to qualifying category lines", () => {
    const result = computeOrderPricing({
      lines: [
        simpleLine(10000, 1, "spirits"),
        simpleLine(5000, 1, "beer"),
      ],
      fees: NO_FEES,
      happyHourRules: [{
        id: "hh1",
        isActive: true,
        daysOfWeek: [5],
        startTime: "22:00",
        endTime: "23:30",
        discountPct: 20,
        appliesToCategoryIds: ["spirits"],
      }],
      tipCents: 0,
      now: fridayNight,
    });
    // raw subtotal: 10000 + 5000 = 15000
    // spirits discount: 10000 * 20% = 2000, beer: no discount
    expect(result.subtotalCents).toBe(15000);
    expect(result.discountCents).toBe(2000);
    expect(result.discountedSubtotalCents).toBe(13000);
  });

  it("empty appliesToCategoryIds means all categories", () => {
    const result = computeOrderPricing({
      lines: [
        simpleLine(10000, 1, "spirits"),
        simpleLine(5000, 1, "beer"),
      ],
      fees: NO_FEES,
      happyHourRules: [{
        id: "hh1",
        isActive: true,
        daysOfWeek: [5],
        startTime: "22:00",
        endTime: "23:30",
        discountPct: 10,
        appliesToCategoryIds: [],
      }],
      tipCents: 0,
      now: fridayNight,
    });
    expect(result.discountCents).toBe(1500); // 10% of 15000
  });

  it("does not apply when day doesn't match", () => {
    const thursday = new Date("2026-07-09T23:00:00"); // Thursday = day 4
    const result = computeOrderPricing({
      lines: [simpleLine(10000, 1, "spirits")],
      fees: NO_FEES,
      happyHourRules: [{
        id: "hh1",
        isActive: true,
        daysOfWeek: [5], // Friday only
        startTime: "22:00",
        endTime: "23:30",
        discountPct: 20,
        appliesToCategoryIds: [],
      }],
      tipCents: 0,
      now: thursday,
    });
    expect(result.discountCents).toBe(0);
  });

  it("does not apply when time is outside window", () => {
    const earlyFriday = new Date("2026-07-10T20:00:00"); // 20:00 — before 22:00
    const result = computeOrderPricing({
      lines: [simpleLine(10000, 1)],
      fees: NO_FEES,
      happyHourRules: [{
        id: "hh1",
        isActive: true,
        daysOfWeek: [5],
        startTime: "22:00",
        endTime: "23:30",
        discountPct: 20,
        appliesToCategoryIds: [],
      }],
      tipCents: 0,
      now: earlyFriday,
    });
    expect(result.discountCents).toBe(0);
  });

  it("handles midnight-crossing window (22:00–02:00)", () => {
    // Saturday at 01:00 — day 6, but the rule is for Friday (day 5) 22:00–02:00
    // The rule starts on Friday night and crosses into Saturday morning
    const saturdayEarlyMorning = new Date("2026-07-11T01:00:00"); // Saturday day 6
    const result = computeOrderPricing({
      lines: [simpleLine(10000, 1)],
      fees: NO_FEES,
      happyHourRules: [{
        id: "hh1",
        isActive: true,
        daysOfWeek: [5], // Friday — the day the window starts
        startTime: "22:00",
        endTime: "02:00",
        discountPct: 25,
        appliesToCategoryIds: [],
      }],
      tipCents: 0,
      now: saturdayEarlyMorning,
    });
    expect(result.discountCents).toBe(2500);
  });

  it("inactive rules are ignored", () => {
    const result = computeOrderPricing({
      lines: [simpleLine(10000, 1)],
      fees: NO_FEES,
      happyHourRules: [{
        id: "hh1",
        isActive: false,
        daysOfWeek: [5],
        startTime: "22:00",
        endTime: "23:30",
        discountPct: 50,
        appliesToCategoryIds: [],
      }],
      tipCents: 0,
      now: fridayNight,
    });
    expect(result.discountCents).toBe(0);
  });

  it("best matching rule wins when multiple match", () => {
    const result = computeOrderPricing({
      lines: [simpleLine(10000, 1, "spirits")],
      fees: NO_FEES,
      happyHourRules: [
        {
          id: "hh1",
          isActive: true,
          daysOfWeek: [5],
          startTime: "22:00",
          endTime: "23:30",
          discountPct: 10,
          appliesToCategoryIds: [],
        },
        {
          id: "hh2",
          isActive: true,
          daysOfWeek: [5],
          startTime: "22:00",
          endTime: "23:30",
          discountPct: 25,
          appliesToCategoryIds: ["spirits"],
        },
      ],
      tipCents: 0,
      now: fridayNight,
    });
    // The highest applicable discount should win for spirits
    expect(result.discountCents).toBe(2500);
  });

  it("fees are computed on the discounted subtotal, not the raw subtotal", () => {
    const result = computeOrderPricing({
      lines: [simpleLine(10000, 1)],
      fees: [{ id: "f1", name: "Service", type: "percentage", value: 1000 }], // 10%
      happyHourRules: [{
        id: "hh1",
        isActive: true,
        daysOfWeek: [5],
        startTime: "22:00",
        endTime: "23:30",
        discountPct: 20,
        appliesToCategoryIds: [],
      }],
      tipCents: 0,
      now: fridayNight,
    });
    // discount: 2000 → discounted subtotal: 8000
    // fee: 10% of 8000 = 800
    expect(result.discountedSubtotalCents).toBe(8000);
    expect(result.feeLines[0].amountCents).toBe(800);
  });
});

// ── Package lines ─────────────────────────────────────────────────────

describe("pricing engine — package lines", () => {
  it("prices package line like any other line (by its priceCents)", () => {
    const result = computeOrderPricing({
      lines: [{
        menuItemId: "pkg-1",
        name: "Party Pack",
        priceCents: 50000,
        quantity: 1,
        categoryId: "packages",
        modifiers: [],
        packageId: "pkg-1",
      }],
      fees: NO_FEES,
      happyHourRules: NO_HAPPY_HOUR,
      tipCents: 0,
      now: new Date("2026-07-10T23:00:00"),
    });
    expect(result.subtotalCents).toBe(50000);
  });
});

// ── Sum property ──────────────────────────────────────────────────────

describe("pricing engine — invariants", () => {
  it("Σ parts === total, always", () => {
    const scenarios: PricingInput[] = [
      {
        lines: [simpleLine(9999, 3)],
        fees: [
          { id: "f1", name: "TPS", type: "percentage", value: 500 },
          { id: "f2", name: "TVQ", type: "percentage", value: 998 },
        ],
        happyHourRules: NO_HAPPY_HOUR,
        tipCents: 1234,
        now: new Date("2026-07-10T23:00:00"),
      },
      {
        lines: [simpleLine(1, 1)],
        fees: [{ id: "f1", name: "Service", type: "percentage", value: 500 }],
        happyHourRules: NO_HAPPY_HOUR,
        tipCents: 1,
        now: new Date("2026-07-10T23:00:00"),
      },
      {
        lines: [simpleLine(10000, 1), simpleLine(5000, 2)],
        fees: [{ id: "f1", name: "Cover", type: "flat", valueCents: 200 }],
        happyHourRules: [{
          id: "hh1",
          isActive: true,
          daysOfWeek: [5],
          startTime: "22:00",
          endTime: "23:30",
          discountPct: 15,
          appliesToCategoryIds: [],
        }],
        tipCents: 3000,
        now: new Date("2026-07-10T23:00:00"),
      },
    ];

    for (const input of scenarios) {
      const r = computeOrderPricing(input);
      const feesSum = r.feeLines.reduce((s, f) => s + f.amountCents, 0);
      expect(r.totalFeeCents).toBe(feesSum);
      expect(r.totalCents).toBe(r.discountedSubtotalCents + r.totalFeeCents + r.tipCents);
    }
  });

  it("all amounts are integers (no float leaks)", () => {
    const result = computeOrderPricing({
      lines: [simpleLine(333, 3)],
      fees: [{ id: "f1", name: "TVQ", type: "percentage", value: 998 }],
      happyHourRules: NO_HAPPY_HOUR,
      tipCents: 77,
      now: new Date("2026-07-10T23:00:00"),
    });
    expect(Number.isInteger(result.subtotalCents)).toBe(true);
    expect(Number.isInteger(result.discountCents)).toBe(true);
    expect(Number.isInteger(result.discountedSubtotalCents)).toBe(true);
    expect(Number.isInteger(result.totalFeeCents)).toBe(true);
    expect(Number.isInteger(result.tipCents)).toBe(true);
    expect(Number.isInteger(result.totalCents)).toBe(true);
    for (const fl of result.feeLines) {
      expect(Number.isInteger(fl.amountCents)).toBe(true);
    }
  });
});
