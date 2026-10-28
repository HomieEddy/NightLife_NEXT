import { describe, it, expect } from "vitest";
import { feeLabel, getAutoGratuityRate } from "./fees";
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
