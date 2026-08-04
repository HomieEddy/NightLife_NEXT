import { describe, it, expect } from "vitest";
import {
  computeFeeLines,
  computeServiceFee,
  feeLabel,
  getAutoGratuityRate,
} from "./fees";
import type { Venue } from "@/lib/types";

function venue(overrides: Partial<Venue> = {}): Venue {
  return {
    id: "v1",
    name: "Test",
    slug: "test",
    address: "1 St",
    city: "Montreal",
    timezone: "America/Montreal",
    currency: "CAD",
    openingHours: [],
    serviceFees: [],
    slaThresholds: { orderWarnMinutes: 6, orderCriticalMinutes: 12, helpWarnMinutes: 4, helpCriticalMinutes: 8 },
    floorMap: { width: 16, height: 9 },
    autoApproveGuests: false,
    nightStartHour: 18,
    nightEndHour: 10,
    legalCapacity: 250,
    legalDrinkingAge: 18,
    logoInitials: "T",
    lastCallAutoFlagTables: true,
    publicSlug: "test",
    minimumSpendWarningRatio: 0.8,
    occupancyWarnRatio: 0.9,
    tipPresets: [15, 18, 20],
    defaultTipPct: 18,
    compThresholdCents: 5000,
    coatCheckEnabled: false,
    doorRequiresIdCheck: false,
    guestLocale: "en",
    ...overrides,
  };
}

describe("computeFeeLines", () => {
  it("returns no lines for an empty or negative subtotal — flat fees must not fire on an empty cart", () => {
    const v = venue({ serviceFees: [{ id: "f1", name: "Flat", type: "flat", value: 10 }] });
    expect(computeFeeLines(0, v)).toEqual([]);
    expect(computeFeeLines(-5, v)).toEqual([]);
  });

  it("applies flat fees at their face value", () => {
    const v = venue({ serviceFees: [{ id: "f1", name: "Flat", type: "flat", value: 10 }] });
    const lines = computeFeeLines(100, v);
    expect(lines).toHaveLength(1);
    expect(lines[0].amount).toBe(10);
  });

  it("rounds percentage fees to the cent (half-cent rounding)", () => {
    const v = venue({ serviceFees: [{ id: "f1", name: "Pct", type: "percentage", value: 9.975 }] });
    // 100.00 * 9.975% = 9.975 → 10.00 after rounding... use an awkward subtotal
    const lines = computeFeeLines(33.33, v);
    expect(lines[0].amount).toBe(Math.round(33.33 * 9.975) / 100);
  });

  it("stacks multiple fees into one line each", () => {
    const v = venue({
      serviceFees: [
        { id: "f1", name: "Flat", type: "flat", value: 5 },
        { id: "f2", name: "Pct", type: "percentage", value: 9.975 },
      ],
    });
    const lines = computeFeeLines(200, v);
    expect(lines).toHaveLength(2);
    expect(lines[0].amount).toBe(5);
    expect(lines[1].amount).toBe(19.95);
  });
});

describe("computeServiceFee", () => {
  it("sums all lines rounded to the cent", () => {
    const v = venue({
      serviceFees: [
        { id: "f1", name: "Flat", type: "flat", value: 5 },
        { id: "f2", name: "Pct", type: "percentage", value: 9.975 },
      ],
    });
    expect(computeServiceFee(200, v)).toBe(24.95);
  });

  it("is zero for empty orders", () => {
    const v = venue({ serviceFees: [{ id: "f1", name: "Flat", type: "flat", value: 10 }] });
    expect(computeServiceFee(0, v)).toBe(0);
  });
});

describe("feeLabel", () => {
  it("labels flat and percentage fees", () => {
    expect(feeLabel({ id: "f", name: "Flat", type: "flat", value: 10 })).toBe("$10 flat");
    expect(feeLabel({ id: "f", name: "Pct", type: "percentage", value: 5 })).toBe("5%");
  });
});

describe("getAutoGratuityRate", () => {
  const rules = [
    { id: "r6", minPartySize: 6, ratePct: 18 },
    { id: "r10", minPartySize: 10, ratePct: 20 },
  ];

  it("returns null when no rules are configured", () => {
    expect(getAutoGratuityRate(venue(), 12)).toBeNull();
  });

  it("returns null below the smallest threshold", () => {
    expect(getAutoGratuityRate(venue({ autoGratuityRules: rules }), 4)).toBeNull();
  });

  it("picks the highest qualifying threshold", () => {
    expect(getAutoGratuityRate(venue({ autoGratuityRules: rules }), 8)).toBe(18);
    expect(getAutoGratuityRate(venue({ autoGratuityRules: rules }), 12)).toBe(20);
  });

  it("bumps +2 points on a table minimum above $500", () => {
    expect(getAutoGratuityRate(venue({ autoGratuityRules: rules }), 8, 80000)).toBe(20);
    expect(getAutoGratuityRate(venue({ autoGratuityRules: rules }), 8, 50000)).toBe(18);
    expect(getAutoGratuityRate(venue({ autoGratuityRules: rules }), 12, 80000)).toBe(22);
  });
});
