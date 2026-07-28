import { describe, expect, it } from "vitest";
import { toCents, fromCents, splitCents } from "./money";

describe("toCents", () => {
  it("converts dollars to cents", () => {
    expect(toCents(12.99)).toBe(1299);
    expect(toCents(0)).toBe(0);
    expect(toCents(100)).toBe(10000);
  });

  it("rounds to nearest cent", () => {
    // 1.005 * 100 = 100.499... in IEEE 754; Math.round gives 100.
    // This is expected — inputs from user strings go through parseFloat,
    // so callers should round at the parse boundary, not rely on .005 rounding up.
    expect(toCents(1.005)).toBe(100);
    expect(toCents(0.1 + 0.2)).toBe(30);
  });
});

describe("fromCents", () => {
  it("converts cents to dollars", () => {
    expect(fromCents(1299)).toBe(12.99);
    expect(fromCents(0)).toBe(0);
    expect(fromCents(1)).toBe(0.01);
  });
});

describe("splitCents", () => {
  it("splits evenly when divisible", () => {
    const result = splitCents(900, 3);
    expect(result).toEqual([300, 300, 300]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(900);
  });

  it("distributes remainder to earlier shares", () => {
    const result = splitCents(1000, 3);
    expect(result).toEqual([334, 333, 333]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it("handles single share", () => {
    expect(splitCents(1299, 1)).toEqual([1299]);
  });

  it("handles large remainder", () => {
    const result = splitCents(7, 4);
    expect(result).toEqual([2, 2, 2, 1]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(7);
  });

  it("handles zero total", () => {
    const result = splitCents(0, 3);
    expect(result).toEqual([0, 0, 0]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(0);
  });

  it("throws on zero shares", () => {
    expect(() => splitCents(100, 0)).toThrow("shares must be positive");
  });

  it("throws on negative shares", () => {
    expect(() => splitCents(100, -1)).toThrow("shares must be positive");
  });

  it("sum always equals totalCents for arbitrary inputs", () => {
    for (let total = 0; total <= 50; total++) {
      for (let shares = 1; shares <= 7; shares++) {
        const result = splitCents(total, shares);
        expect(result.reduce((a, b) => a + b, 0)).toBe(total);
        expect(result).toHaveLength(shares);
      }
    }
  });
});
