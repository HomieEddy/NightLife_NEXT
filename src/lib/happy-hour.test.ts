import { describe, it, expect } from "vitest";
import { isInHappyHourWindow, bestHappyHourDiscount, type HappyHourDiscountRule } from "./happy-hour";

// Wednesday July 15 2026, local time — day 3.
const wed = (hour: number, minute = 0) => new Date(2026, 6, 15, hour, minute);

function rule(patch: Partial<HappyHourDiscountRule> = {}): HappyHourDiscountRule {
  return {
    id: "hh-test",
    isActive: true,
    daysOfWeek: [3],
    startTime: "18:00",
    endTime: "21:00",
    discountPct: 20,
    appliesToCategoryIds: [],
    ...patch,
  };
}

describe("isInHappyHourWindow", () => {
  it("matches inside a same-day window", () => {
    expect(isInHappyHourWindow(rule(), wed(19))).toBe(true);
  });

  it("is exclusive of the end minute and inclusive of the start", () => {
    expect(isInHappyHourWindow(rule(), wed(18, 0))).toBe(true);
    expect(isInHappyHourWindow(rule(), wed(21, 0))).toBe(false);
  });

  it("rejects a non-listed weekday", () => {
    expect(isInHappyHourWindow(rule({ daysOfWeek: [5] }), wed(19))).toBe(false);
  });

  it("rejects an inactive rule", () => {
    expect(isInHappyHourWindow(rule({ isActive: false }), wed(19))).toBe(false);
  });

  it("spans midnight into the next calendar day", () => {
    const lateNight = rule({ daysOfWeek: [2], startTime: "22:00", endTime: "02:00" }); // Tuesday night
    expect(isInHappyHourWindow(lateNight, wed(1))).toBe(true); // 01:00 Wednesday = Tuesday's night
    expect(isInHappyHourWindow(lateNight, wed(3))).toBe(false);
    expect(isInHappyHourWindow(lateNight, wed(22))).toBe(false); // Wednesday 22:00 not listed
  });
});

describe("bestHappyHourDiscount", () => {
  it("returns null when no rule is in window", () => {
    expect(bestHappyHourDiscount([rule()], "cat-vodka", wed(12))).toBeNull();
  });

  it("scopes to the rule's categories", () => {
    const champagneOnly = rule({ appliesToCategoryIds: ["cat-champagne"] });
    expect(bestHappyHourDiscount([champagneOnly], "cat-vodka", wed(19))).toBeNull();
    expect(bestHappyHourDiscount([champagneOnly], "cat-champagne", wed(19))).toEqual({
      ruleId: "hh-test",
      discountPct: 20,
    });
  });

  it("treats an empty category list as covering every category", () => {
    expect(bestHappyHourDiscount([rule()], "cat-anything", wed(19))).not.toBeNull();
  });

  it("picks the highest discount when rules overlap", () => {
    const rules = [
      rule({ id: "hh-small", discountPct: 10 }),
      rule({ id: "hh-big", discountPct: 25 }),
    ];
    expect(bestHappyHourDiscount(rules, "cat-vodka", wed(19))).toEqual({
      ruleId: "hh-big",
      discountPct: 25,
    });
  });
});
