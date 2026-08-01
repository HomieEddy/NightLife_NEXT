import { describe, it, expect } from "vitest";
import { computeCommissionLine, computeCommissionLines } from "@/features/workforce/commission-core";
import type { CommissionRule } from "@/lib/types";

describe("computeCommissionLine", () => {
  describe("net-revenue basis with ratePct", () => {
    const rule: CommissionRule = {
      id: "cr1", venueId: "v1", staffId: "st-julien",
      basis: "net-revenue", ratePct: 10,
    };

    it("computes 10% of basis correctly", () => {
      expect(computeCommissionLine(rule, 420000)).toBe(42000);
    });

    it("rounds to nearest cent", () => {
      expect(computeCommissionLine(rule, 420005)).toBe(42001); // 42000.5 → 42001
    });

    it("returns 0 for zero basis", () => {
      expect(computeCommissionLine(rule, 0)).toBe(0);
    });
  });

  describe("qualifier: minPartySize", () => {
    const rule: CommissionRule = {
      id: "cr2", venueId: "v1", staffId: "st-julien",
      basis: "net-revenue", ratePct: 10,
      qualifier: { minPartySize: 4 },
    };

    it("earns commission when party meets minimum", () => {
      expect(computeCommissionLine(rule, 420000, 4)).toBe(42000);
    });

    it("earns nothing when party is below minimum (no-show equivalent)", () => {
      expect(computeCommissionLine(rule, 420000, 2)).toBe(0);
    });

    it("earns nothing when party is 0", () => {
      expect(computeCommissionLine(rule, 420000, 0)).toBe(0);
    });
  });

  describe("flat commission (per-reservation)", () => {
    const rule: CommissionRule = {
      id: "cr3", venueId: "v1", staffId: "st-chloe",
      basis: "per-reservation", flatCents: 2500,
    };

    it("returns flat amount regardless of basis", () => {
      expect(computeCommissionLine(rule, 0)).toBe(2500);
      expect(computeCommissionLine(rule, 500000)).toBe(2500);
    });
  });

  describe("table-minimum basis", () => {
    const rule: CommissionRule = {
      id: "cr4", venueId: "v1", basis: "table-minimum", ratePct: 5,
    };

    it("computes 5% of table minimum spend", () => {
      expect(computeCommissionLine(rule, 200000)).toBe(10000);
    });
  });
});

describe("computeCommissionLines", () => {
  it("computes multiple lines from source data", () => {
    const rule: CommissionRule = {
      id: "cr1", venueId: "v1", staffId: "st-julien",
      basis: "net-revenue", ratePct: 10,
    };
    const sources = [
      { sourceType: "session" as const, sourceId: "s-1", basisCents: 420000, partySize: 5 },
      { sourceType: "session" as const, sourceId: "s-2", basisCents: 310000, partySize: 3 },
    ];
    const lines = computeCommissionLines(rule, sources);
    expect(lines).toHaveLength(2);
    expect(lines[0].earnedCents).toBe(42000);
    expect(lines[1].earnedCents).toBe(31000);
    // type check: CommissionLine shape
    expect(lines[0].sourceType).toBe("session");
    expect(lines[0].sourceId).toBe("s-1");
    expect(lines[0].basisCents).toBe(420000);
  });

  it("respects qualifiers per source", () => {
    const rule: CommissionRule = {
      id: "cr2", venueId: "v1", basis: "net-revenue", ratePct: 10,
      qualifier: { minPartySize: 4 },
    };
    const sources = [
      { sourceType: "session" as const, sourceId: "s-big", basisCents: 500000, partySize: 6 },
      { sourceType: "session" as const, sourceId: "s-small", basisCents: 300000, partySize: 2 },
    ];
    const lines = computeCommissionLines(rule, sources);
    expect(lines[0].earnedCents).toBe(50000); // qualifies
    expect(lines[1].earnedCents).toBe(0);      // doesn't qualify
  });
});
