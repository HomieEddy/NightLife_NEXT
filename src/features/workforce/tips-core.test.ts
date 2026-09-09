import { describe, it, expect } from "vitest";
import { distributeTips } from "@/features/workforce/tips-core";
import type { TipPoolRule } from "@/lib/types";

// ── distributeTips (INV-W2: Σ shareCents === poolCents) ──────────

const staffBasis = [
  { staffId: "st-a", hoursWorked: 480, weight: 1.0, role: "bartender" },
  { staffId: "st-b", hoursWorked: 360, weight: 1.0, role: "runner" },
  { staffId: "st-c", hoursWorked: 240, weight: 1.0, role: "host" },
  { staffId: "st-d", hoursWorked: 0, weight: 1.0, role: "security" },
];

describe("distributeTips", () => {
  describe("hours-weighted basis", () => {
    const rule: TipPoolRule = {
      id: "r1", venueId: "v1", name: "Hours", basis: "hours-weighted",
      includeRoles: ["bartender", "runner", "host", "security"],
      houseRetentionPct: 0, active: true,
    };

    it("sum of shares equals poolCents exactly (INV-W2)", () => {
      const poolCents = 100000; // $1,000.00
      const lines = distributeTips(poolCents, rule, staffBasis);
      const total = lines.reduce((s, l) => s + l.shareCents, 0);
      expect(total).toBe(poolCents);
    });

    it("distributes proportionally to hours worked", () => {
      const poolCents = 108000; // divisible by total hours (1080)
      const lines = distributeTips(poolCents, rule, staffBasis);
      // st-a: 480/1080 * 108000 = 48000
      // st-b: 360/1080 * 108000 = 36000
      // st-c: 240/1080 * 108000 = 24000
      // st-d: 0/1080 * 108000 = 0
      expect(lines.find((l) => l.staffId === "st-a")!.shareCents).toBe(48000);
      expect(lines.find((l) => l.staffId === "st-b")!.shareCents).toBe(36000);
      expect(lines.find((l) => l.staffId === "st-c")!.shareCents).toBe(24000);
      expect(lines.find((l) => l.staffId === "st-d")!.shareCents).toBe(0);
    });

    it("handles an indivisible pool — remainder distributed largest-remainder", () => {
      const poolCents = 10001; // $100.01 — 3 cents remainder
      const lines = distributeTips(poolCents, rule, staffBasis);
      const total = lines.reduce((s, l) => s + l.shareCents, 0);
      expect(total).toBe(poolCents);
    });

    it("handles a three-person pool of $100.01 (specific PLAN-18 test case)", () => {
      const three = staffBasis.slice(0, 3);
      const poolCents = 10001;
      const lines = distributeTips(poolCents, rule, three);
      const total = lines.reduce((s, l) => s + l.shareCents, 0);
      expect(total).toBe(poolCents);
    });

    it("handles zero-hour member", () => {
      // staff-d has 0 hours
      const poolCents = 50000;
      const lines = distributeTips(poolCents, rule, staffBasis);
      expect(lines.find((l) => l.staffId === "st-d")!.shareCents).toBe(0);
    });

    it("applies tipPoolWeight correctly", () => {
      const weighted = [
        { staffId: "st-a", hoursWorked: 100, weight: 2.0, role: "bartender" },
        { staffId: "st-b", hoursWorked: 100, weight: 1.0, role: "bartender" },
      ];
      const poolCents = 30000;
      const lines = distributeTips(poolCents, rule, weighted);
      // st-a effective: 200, st-b effective: 100 → 2:1 ratio
      expect(lines.find((l) => l.staffId === "st-a")!.shareCents).toBe(20000);
      expect(lines.find((l) => l.staffId === "st-b")!.shareCents).toBe(10000);
    });
  });

  describe("equal basis", () => {
    const rule: TipPoolRule = {
      id: "r2", venueId: "v1", name: "Equal", basis: "equal",
      includeRoles: ["bartender", "runner", "host"],
      houseRetentionPct: 0, active: true,
    };

    it("splits pool equally among included roles", () => {
      const three = staffBasis.slice(0, 3);
      const poolCents = 30000;
      const lines = distributeTips(poolCents, rule, three);
      for (const l of lines) {
        expect(l.shareCents).toBe(10000);
      }
    });

    it("handles remainder with equal split", () => {
      const three = staffBasis.slice(0, 3);
      const poolCents = 10001;
      const lines = distributeTips(poolCents, rule, three);
      const total = lines.reduce((s, l) => s + l.shareCents, 0);
      expect(total).toBe(poolCents);
    });
  });

  describe("role-percentage basis", () => {
    const rule: TipPoolRule = {
      id: "r3", venueId: "v1", name: "Role %", basis: "role-percentage",
      rolePercentages: { bartender: 50, runner: 30, host: 20, security: 0, manager: 0, promoter: 0 },
      includeRoles: ["bartender", "runner", "host"],
      houseRetentionPct: 0, active: true,
    };

    it("distributes by role percentage", () => {
      const poolCents = 100000;
      const lines = distributeTips(poolCents, rule, staffBasis);
      // bartender: 50%, runner: 30%, host: 20%
      expect(lines.find((l) => l.staffId === "st-a")!.shareCents).toBe(50000);
      expect(lines.find((l) => l.staffId === "st-b")!.shareCents).toBe(30000);
      expect(lines.find((l) => l.staffId === "st-c")!.shareCents).toBe(20000);
    });

    it("security excluded (role not in includeRoles)", () => {
      const fourPeople = staffBasis; // includes security
      const poolCents = 100000;
      const lines = distributeTips(poolCents, rule, fourPeople);
      // security is not in includeRoles, so it's excluded from the distribution
      expect(lines.find((l) => l.staffId === "st-d")).toBeUndefined();
      // only 3 of 4 staff are included
      expect(lines).toHaveLength(3);
      const total = lines.reduce((s, l) => s + l.shareCents, 0);
      expect(total).toBe(poolCents);
    });
  });

  describe("empty set", () => {
    it("returns empty lines when no staff match includeRoles", () => {
      const rule: TipPoolRule = {
        id: "r4", venueId: "v1", name: "x", basis: "equal",
        includeRoles: ["manager"], // nobody is manager
        houseRetentionPct: 0, active: true,
      };
      expect(distributeTips(10000, rule, staffBasis)).toHaveLength(0);
    });
  });

  describe("total weight zero", () => {
    it("returns zero shares when all weights are zero", () => {
      const zeroBasis = [
        { staffId: "st-x", hoursWorked: 0, weight: 0, role: "bartender" },
      ];
      const rule: TipPoolRule = {
        id: "r5", venueId: "v1", name: "z", basis: "hours-weighted",
        includeRoles: ["bartender"],
        houseRetentionPct: 0, active: true,
      };
      const lines = distributeTips(10000, rule, zeroBasis);
      expect(lines).toHaveLength(1);
      expect(lines[0].shareCents).toBe(0);
    });
  });

  describe("house retention", () => {
    const rule: TipPoolRule = {
      id: "r6", venueId: "v1", name: "Retained", basis: "hours-weighted",
      includeRoles: ["bartender", "runner", "host"],
      houseRetentionPct: 10, active: true,
    };

    it("keeps the retention for the house — shares sum to 90% of the pool", () => {
      const poolCents = 100000;
      const lines = distributeTips(poolCents, rule, staffBasis);
      const total = lines.reduce((s, l) => s + l.shareCents, 0);
      expect(total).toBe(90000);
      // Shares are still hours-proportional against the distributable pool:
      // 90000 * (480/1080) = 40000, etc.
      const byId = Object.fromEntries(lines.map((l) => [l.staffId, l.shareCents]));
      expect(byId["st-a"]).toBe(40000);
      expect(byId["st-b"]).toBe(30000);
      expect(byId["st-c"]).toBe(20000);
    });

    it("100% retention leaves every share at zero", () => {
      const full: TipPoolRule = { ...rule, houseRetentionPct: 100 };
      const lines = distributeTips(100000, full, staffBasis);
      expect(lines.reduce((s, l) => s + l.shareCents, 0)).toBe(0);
    });

    it("retention is clamped to the 0-100 range", () => {
      const over: TipPoolRule = { ...rule, houseRetentionPct: 150 };
      expect(distributeTips(10000, over, staffBasis).reduce((s, l) => s + l.shareCents, 0)).toBe(0);
      const under: TipPoolRule = { ...rule, houseRetentionPct: -5 };
      expect(distributeTips(10000, under, staffBasis).reduce((s, l) => s + l.shareCents, 0)).toBe(10000);
    });

    it("matches the workforce retention formula at non-round pools (INV regression)", () => {
      // pool 199, retention 50% → retained = round(199*50/100) = 100 → distributable = 99.
      const r: TipPoolRule = { ...rule, houseRetentionPct: 50 };
      const lines = distributeTips(199, r, staffBasis);
      expect(lines.reduce((s, l) => s + l.shareCents, 0)).toBe(99);
    });
  });
});
