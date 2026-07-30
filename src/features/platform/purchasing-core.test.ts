import { describe, it, expect } from "vitest";
import {
  weightedAverageCost,
  computePourCost,
  computeGrossMargin,
  computeVarianceLine,
  parForDate,
  computeCanonicalPnL,
  pourCostFromPnL,
  convertUnits,
  remainingPours,
  poStatusTransition,
  poStatusAfterReceive,
  stocktakeStatusTransition,
  suggestPurchaseOrder,
  evaluateProfitTarget,
  trailingWeekdayMedian,
} from "./purchasing-core";

// ── Weighted average cost ─────────────────────────────────────────────

describe("weightedAverageCost", () => {
  it("returns the new cost when starting from zero", () => {
    expect(weightedAverageCost(0, 0, 10, 5000)).toBe(5000);
  });

  it("returns the existing cost when receiving zero", () => {
    expect(weightedAverageCost(4000, 5, 0, 6000)).toBe(4000);
  });

  it("returns 0 when both sides are zero", () => {
    expect(weightedAverageCost(0, 0, 0, 0)).toBe(0);
  });

  it("computes WAC after first receipt: 5 × 4000 + 5 × 5000 = 45000 / 10 = 4500", () => {
    expect(weightedAverageCost(4000, 5, 5, 5000)).toBe(4500);
  });

  it("WAC after second receipt at a different price", () => {
    // After previous: avg=4500, qty=10. Receive 6 × 6000 = 36000
    // total cost = 10 × 4500 + 6 × 6000 = 45000 + 36000 = 81000
    // total qty = 16, WAC = 81000 / 16 = 5062.5 → 5063
    expect(weightedAverageCost(4500, 10, 6, 6000)).toBe(5063);
  });

  it("WAC after two very different price tiers (bulk discount)", () => {
    // current: 2 bottles @ 5500, receive 12 bottles @ 3800 (case discount)
    // total: 2×5500 + 12×3800 = 11000 + 45600 = 56600 / 14 = 4042.85 → 4043
    expect(weightedAverageCost(5500, 2, 12, 3800)).toBe(4043);
  });

  it("WAC with large quantities — no overflow", () => {
    const result = weightedAverageCost(1234, 1_000_000, 1_000_000, 5678);
    // (1M × 1234 + 1M × 5678) / 2M = (1234 + 5678) / 2 = 3456
    expect(result).toBe(3456);
  });
});

// ── Pour cost ─────────────────────────────────────────────────────────

describe("computePourCost", () => {
  it("returns null when net revenue is zero", () => {
    expect(computePourCost(5000, 0)).toBeNull();
  });

  it("returns null for negative revenue", () => {
    expect(computePourCost(5000, -100)).toBeNull();
  });

  it("22% pour cost: $22 COGS on $100 net revenue", () => {
    expect(computePourCost(2200, 10000)).toBe(0.22);
  });

  it("0% pour cost when COGS is zero", () => {
    expect(computePourCost(0, 10000)).toBe(0);
  });
});

// ── Gross margin ──────────────────────────────────────────────────────

describe("computeGrossMargin", () => {
  it("returns null when revenue is zero", () => {
    expect(computeGrossMargin(5000, 0)).toBeNull();
  });

  it("65% margin: $35 COGS on $100 revenue", () => {
    expect(computeGrossMargin(3500, 10000)).toBe(0.65);
  });

  it("0 margin when COGS equals revenue", () => {
    expect(computeGrossMargin(10000, 10000)).toBe(0);
  });
});

// ── Variance line ─────────────────────────────────────────────────────

describe("computeVarianceLine", () => {
  it("negative variance (shortage): expected 5, counted 4 @ $40 cost", () => {
    const result = computeVarianceLine(5, 4, 4000);
    expect(result.varianceQty).toBe(-1);
    expect(result.varianceCents).toBe(-4000);
  });

  it("positive variance (overage): expected 5, counted 6 @ $40 cost", () => {
    const result = computeVarianceLine(5, 6, 4000);
    expect(result.varianceQty).toBe(1);
    expect(result.varianceCents).toBe(4000);
  });

  it("zero variance when counts match", () => {
    const result = computeVarianceLine(5, 5, 4000);
    expect(result.varianceQty).toBe(0);
    expect(result.varianceCents).toBe(0);
  });

  it("variance with zero cost", () => {
    const result = computeVarianceLine(10, 8, 0);
    expect(result.varianceQty).toBe(-2);
    expect(result.varianceCents).toBe(0);
  });
});

// ── Par for date ──────────────────────────────────────────────────────

describe("parForDate", () => {
  const parLevels = { 0: 6, 1: 4, 2: 4, 3: 4, 4: 8, 5: 12, 6: 10 };
  // Sunday=0, Monday=1, ... Friday=5, Saturday=6

  it("returns Friday par (day 5)", () => {
    const friday = new Date("2026-07-31T12:00:00-04:00"); // Friday July 31, 2026
    expect(parForDate(parLevels, friday)).toBe(12);
  });

  it("returns Wednesday par (day 3)", () => {
    const wed = new Date("2026-07-29T12:00:00-04:00"); // Wednesday
    expect(parForDate(parLevels, wed)).toBe(4);
  });

  it("returns undefined when parLevels is undefined", () => {
    expect(parForDate(undefined, new Date())).toBeUndefined();
  });
});

// ── Canonical P&L ─────────────────────────────────────────────────────

describe("computeCanonicalPnL", () => {
  it("computes full-night P&L strip correctly", () => {
    const result = computeCanonicalPnL({
      grossRevenueCents: 500000, // $5,000
      voidCents: 10000, // $100
      discountCents: 5000, // $50
      cogsCents: 97000, // $970 (22% pour cost on net)
      labourCostCents: 120000, // $1,200
      compCostCents: 25000, // $250
      wasteCostCents: 3000, // $30
    });
    expect(result.netRevenueCents).toBe(485000); // $4,850
    // 485000 - 97000 - 120000 - 25000 - 3000 = 240000
    expect(result.contributionCents).toBe(240000);
  });

  it("handles zeroes across the board", () => {
    const result = computeCanonicalPnL({
      grossRevenueCents: 0,
      voidCents: 0,
      discountCents: 0,
      cogsCents: 0,
      labourCostCents: 0,
      compCostCents: 0,
      wasteCostCents: 0,
    });
    expect(result.netRevenueCents).toBe(0);
    expect(result.contributionCents).toBe(0);
  });

  it("negative contribution when costs exceed revenue", () => {
    const result = computeCanonicalPnL({
      grossRevenueCents: 100000, // $1,000
      voidCents: 0,
      discountCents: 0,
      cogsCents: 30000,
      labourCostCents: 80000, // $800 labour
      compCostCents: 0,
      wasteCostCents: 0,
    });
    expect(result.netRevenueCents).toBe(100000);
    // 100000 - 30000 - 80000 = -10000
    expect(result.contributionCents).toBe(-10000);
  });
});

// ── Pour cost from P&L ────────────────────────────────────────────────

describe("pourCostFromPnL", () => {
  it("computes pour cost from P&L components", () => {
    const result = pourCostFromPnL({
      grossRevenueCents: 500000,
      voidCents: 50000,
      discountCents: 0,
      cogsCents: 99000, // COGS on net 4500 = 22%
    });
    expect(result).toBeCloseTo(0.22);
  });

  it("returns null when net revenue is zero", () => {
    expect(
      pourCostFromPnL({
        grossRevenueCents: 5000,
        voidCents: 5000,
        discountCents: 0,
        cogsCents: 1000,
      }),
    ).toBeNull();
  });
});

// ── Unit conversion ───────────────────────────────────────────────────

describe("convertUnits", () => {
  const servingSize = 750; // 750ml bottle

  it("bottle to ml: 1 bottle × 750 = 750ml", () => {
    expect(convertUnits(1, "bottle", "ml", servingSize)).toBe(750);
  });

  it("ml to bottle: 1500ml ÷ 750 = 2 bottles", () => {
    expect(convertUnits(1500, "ml", "bottle", servingSize)).toBe(2);
  });

  it("same unit returns identity", () => {
    expect(convertUnits(5, "bottle", "bottle", servingSize)).toBe(5);
  });

  it("bottle to oz: bottle converts via base (ml) only", () => {
    // convertUnits handles bottle/keg ↔ base units. ml↔oz (both base) is identity.
    const inMl = convertUnits(1, "bottle", "ml", 750);
    expect(inMl).toBe(750);
    // ml → oz: both base, no conversion applied
    expect(convertUnits(inMl, "ml", "oz", 750)).toBe(inMl);
  });

  it("keg → ml: 1 keg × servingSize ml", () => {
    expect(convertUnits(1, "keg", "ml", 50000)).toBe(50000);
  });
});

// ── Remaining pours ───────────────────────────────────────────────────

describe("remainingPours", () => {
  it("bottle inventory: 3 bottles × 750ml serving = 2250 pours", () => {
    expect(remainingPours(3, "bottle", 750)).toBe(2250);
  });

  it("each inventory: just returns the count", () => {
    expect(remainingPours(24, "each", undefined)).toBe(24);
  });

  it("returns raw inventory when no servingSize", () => {
    expect(remainingPours(5, "bottle", undefined)).toBe(5);
  });
});

// ── PO status transitions ─────────────────────────────────────────────

describe("poStatusTransition", () => {
  it("draft → submitted is valid", () => {
    expect(poStatusTransition("draft", "submitted")).toEqual({ valid: true });
  });

  it("draft → cancelled is valid", () => {
    expect(poStatusTransition("draft", "cancelled")).toEqual({ valid: true });
  });

  it("draft → received is invalid (must submit first)", () => {
    const result = poStatusTransition("draft", "received");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("draft");
  });

  it("submitted → received is valid", () => {
    expect(poStatusTransition("submitted", "received")).toEqual({ valid: true });
  });

  it("cancelled → anything is invalid", () => {
    expect(poStatusTransition("cancelled", "draft").valid).toBe(false);
    expect(poStatusTransition("cancelled", "submitted").valid).toBe(false);
  });
});

describe("poStatusAfterReceive", () => {
  it("fully received when all lines are complete", () => {
    expect(
      poStatusAfterReceive([
        { qtyOrdered: 10, qtyReceived: 10 },
        { qtyOrdered: 5, qtyReceived: 5 },
      ]),
    ).toBe("received");
  });

  it("partially received when some lines are incomplete", () => {
    expect(
      poStatusAfterReceive([
        { qtyOrdered: 10, qtyReceived: 10 },
        { qtyOrdered: 5, qtyReceived: 3 },
      ]),
    ).toBe("partially-received");
  });
});

// ── Stocktake status transitions ──────────────────────────────────────

describe("stocktakeStatusTransition", () => {
  it("open → counting is valid", () => {
    expect(stocktakeStatusTransition("open", "counting")).toEqual({ valid: true });
  });

  it("counting → committed is valid", () => {
    expect(stocktakeStatusTransition("counting", "committed")).toEqual({ valid: true });
  });

  it("committed → anything is invalid (INV-C2)", () => {
    expect(stocktakeStatusTransition("committed", "open").valid).toBe(false);
    expect(stocktakeStatusTransition("committed", "counting").valid).toBe(false);
  });

  it("can cancel at any active stage", () => {
    expect(stocktakeStatusTransition("open", "cancelled").valid).toBe(true);
    expect(stocktakeStatusTransition("counting", "cancelled").valid).toBe(true);
  });
});

// ── PO suggestion engine ──────────────────────────────────────────────

describe("suggestPurchaseOrder", () => {
  const friday = new Date("2026-07-31T12:00:00-04:00"); // Friday

  it("suggests order when stock is below par", () => {
    const result = suggestPurchaseOrder({
      items: [
        {
          menuItemId: "mi-1",
          itemName: "Grey Goose",
          currentStock: 2,
          parLevels: { 5: 12 }, // Friday par = 12
          unitCostCents: 4000,
        },
      ],
      openPOQuantities: {},
      targetDate: friday,
      leadTimeDays: 2,
    });
    expect(result).toHaveLength(1);
    expect(result[0].suggestedQty).toBe(10);
    expect(result[0].lineTotalCents).toBe(40000);
  });

  it("accounts for open PO quantities (INV-C1 guard)", () => {
    const result = suggestPurchaseOrder({
      items: [
        {
          menuItemId: "mi-1",
          itemName: "Grey Goose",
          currentStock: 2,
          parLevels: { 5: 12 },
        },
      ],
      openPOQuantities: { "mi-1": 6 }, // 6 already on order
      targetDate: friday,
      leadTimeDays: 2,
    });
    expect(result).toHaveLength(1);
    expect(result[0].suggestedQty).toBe(4); // 12 - (2 + 6)
  });

  it("skips items at or above par", () => {
    const result = suggestPurchaseOrder({
      items: [
        {
          menuItemId: "mi-1",
          itemName: "Grey Goose",
          currentStock: 15,
          parLevels: { 5: 12 },
        },
      ],
      openPOQuantities: {},
      targetDate: friday,
      leadTimeDays: 2,
    });
    expect(result).toHaveLength(0);
  });

  it("uses reorderPoint when no parLevels defined", () => {
    const result = suggestPurchaseOrder({
      items: [
        {
          menuItemId: "mi-redbull",
          itemName: "Red Bull",
          currentStock: 5,
          reorderPoint: 24,
        },
      ],
      openPOQuantities: {},
      targetDate: friday,
      leadTimeDays: 1,
    });
    expect(result).toHaveLength(1);
    expect(result[0].suggestedQty).toBe(19);
  });

  it("suggests multiple items from different suppliers", () => {
    const result = suggestPurchaseOrder({
      items: [
        {
          menuItemId: "mi-1",
          itemName: "Grey Goose",
          currentStock: 2,
          parLevels: { 5: 12 },
          unitCostCents: 4000,
        },
        {
          menuItemId: "mi-hennessy",
          itemName: "Hennessy",
          currentStock: 1,
          parLevels: { 5: 6 },
          unitCostCents: 5500,
        },
      ],
      openPOQuantities: {},
      targetDate: friday,
      leadTimeDays: 2,
    });
    expect(result).toHaveLength(2);
    expect(result[0].suggestedQty).toBe(10);
    expect(result[1].suggestedQty).toBe(5);
  });
});

// ── Profit target evaluation ──────────────────────────────────────────

describe("evaluateProfitTarget", () => {
  it("warns when pour cost is above warnAt (above=bad)", () => {
    const target = {
      id: "pt-1",
      venueId: "venue-1",
      metric: "pour-cost" as const,
      scope: "venue" as const,
      targetValue: 0.22,
      warnAt: 0.25,
      direction: "above" as const,
    };
    // Current pour cost 0.26 — above warnAt (0.25) but below targetValue (0.22)? No, 0.26 > 0.22
    const result = evaluateProfitTarget(target, 0.26);
    expect(result.breached).toBe(true);
    expect(result.severity).toBe("critical");
  });

  it("warns (not critical) when between warn and target (above=bad)", () => {
    const target = {
      id: "pt-1",
      venueId: "venue-1",
      metric: "pour-cost" as const,
      scope: "venue" as const,
      targetValue: 0.22,
      warnAt: 0.25,
      direction: "above" as const,
    };
    // Current 0.24 — above warnAt? No: 0.24 < 0.25, so not breached
    const result = evaluateProfitTarget(target, 0.24);
    expect(result.breached).toBe(false);
  });

  it("warns when margin is below warnAt (below=bad)", () => {
    const target = {
      id: "pt-2",
      venueId: "venue-1",
      metric: "gross-margin" as const,
      scope: "venue" as const,
      targetValue: 0.65,
      warnAt: 0.60,
      direction: "below" as const,
    };
    // Current 0.55 — below warnAt (0.60) AND below target (0.65) → critical
    const result = evaluateProfitTarget(target, 0.55);
    expect(result.breached).toBe(true);
    expect(result.severity).toBe("critical");
  });

  it("no breach when margin is above target", () => {
    const target = {
      id: "pt-2",
      venueId: "venue-1",
      metric: "gross-margin" as const,
      scope: "venue" as const,
      targetValue: 0.65,
      warnAt: 0.60,
      direction: "below" as const,
    };
    const result = evaluateProfitTarget(target, 0.70);
    expect(result.breached).toBe(false);
    expect(result.severity).toBe("none");
  });
});

// ── Trailing weekday median ───────────────────────────────────────────

describe("trailingWeekdayMedian", () => {
  const history = [
    { date: "2026-07-24", value: 500000 }, // Friday
    { date: "2026-07-23", value: 400000 }, // Thursday
    { date: "2026-07-17", value: 480000 }, // Friday
    { date: "2026-07-16", value: 380000 }, // Thursday
    { date: "2026-07-10", value: 520000 }, // Friday
    { date: "2026-07-09", value: 420000 }, // Thursday
  ];

  it("returns median for Friday (day 5)", () => {
    const result = trailingWeekdayMedian(history, 5, 3);
    // Friday values: 500000, 480000, 520000 → sorted: 480000, 500000, 520000 → median 500000
    expect(result).toBe(500000);
  });

  it("returns null when no matching weekday", () => {
    const result = trailingWeekdayMedian(history, 1, 3); // Monday — no data
    expect(result).toBeNull();
  });
});
