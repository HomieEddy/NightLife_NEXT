import { describe, it, expect } from "vitest";
import {
  computeMinutesWorked,
  businessDateForShift,
  isOvernightShift,
  generateShiftsFromTemplates,
} from "@/features/workforce/time-core";
import type { BreakEntry, ShiftTemplate } from "@/lib/types";

// ── computeMinutesWorked ──────────────────────────────────────────

describe("computeMinutesWorked", () => {
  it("computes simple elapsed minutes (no breaks)", () => {
    const start = new Date("2026-07-24T22:00:00-04:00");
    const end = new Date("2026-07-25T04:00:00-04:00");
    expect(computeMinutesWorked(start, end, [])).toBe(360); // 6h
  });

  it("subtracts unpaid break minutes", () => {
    const start = new Date("2026-07-24T22:00:00-04:00");
    const end = new Date("2026-07-25T04:00:00-04:00");
    const breaks: BreakEntry[] = [
      { startedAt: "2026-07-25T00:00:00-04:00", endedAt: "2026-07-25T00:30:00-04:00", paid: false },
    ];
    expect(computeMinutesWorked(start, end, breaks)).toBe(330); // 360 - 30
  });

  it("does NOT subtract paid break minutes", () => {
    const start = new Date("2026-07-24T22:00:00-04:00");
    const end = new Date("2026-07-25T04:00:00-04:00");
    const breaks: BreakEntry[] = [
      { startedAt: "2026-07-25T01:00:00-04:00", endedAt: "2026-07-25T01:15:00-04:00", paid: true },
    ];
    expect(computeMinutesWorked(start, end, breaks)).toBe(360); // paid break doesn't reduce
  });

  it("ignores breaks that haven't ended yet", () => {
    const start = new Date("2026-07-24T22:00:00-04:00");
    const end = new Date("2026-07-25T04:00:00-04:00");
    const breaks: BreakEntry[] = [
      { startedAt: "2026-07-25T00:00:00-04:00", paid: false }, // not ended yet
    ];
    expect(computeMinutesWorked(start, end, breaks)).toBe(360); // open break ignored
  });

  it("handles multiple breaks (mix of paid and unpaid)", () => {
    const start = new Date("2026-07-24T22:00:00-04:00");
    const end = new Date("2026-07-25T06:00:00-04:00");
    const breaks: BreakEntry[] = [
      { startedAt: "2026-07-25T00:00:00-04:00", endedAt: "2026-07-25T00:30:00-04:00", paid: false },
      { startedAt: "2026-07-25T02:00:00-04:00", endedAt: "2026-07-25T02:15:00-04:00", paid: true },
      { startedAt: "2026-07-25T04:00:00-04:00", endedAt: "2026-07-25T04:10:00-04:00", paid: false },
    ];
    // 480 total - 30 unpaid - 10 unpaid = 440
    expect(computeMinutesWorked(start, end, breaks)).toBe(440);
  });

  it("returns 0 for clockOutAt <= clockInAt (INV-W3 guard)", () => {
    const start = new Date("2026-07-24T22:00:00-04:00");
    const end = new Date("2026-07-24T21:00:00-04:00");
    expect(computeMinutesWorked(start, end, [])).toBe(0);
  });

  it("rounds to nearest minute", () => {
    const start = new Date("2026-07-24T22:00:00-04:00");
    const end = new Date("2026-07-24T22:01:29-04:00"); // 89 seconds = 1.48 min → 1
    expect(computeMinutesWorked(start, end, [])).toBe(1);
  });
});

// ── businessDateForShift ──────────────────────────────────────────

describe("businessDateForShift", () => {
  const NIGHT_START = 18; // 6pm

  // Dates are constructed with UTC components matching venue local time,
  // since businessDateForShift uses getUTCHours() to avoid timezone skew.
  const d = (year: number, month: number, day: number, hour: number, min = 0) =>
    new Date(Date.UTC(year, month, day, hour, min));

  it("returns same calendar date for a shift starting after nightStartHour", () => {
    const shift = d(2026, 6, 24, 22, 0); // Friday 10pm UTC = venue 10pm
    expect(businessDateForShift(shift, NIGHT_START)).toBe("2026-07-24");
  });

  it("returns previous calendar date for a shift starting before nightStartHour", () => {
    const shift = d(2026, 6, 25, 4, 0); // Saturday 4am UTC = venue 4am
    expect(businessDateForShift(shift, NIGHT_START)).toBe("2026-07-24"); // bills to Friday
  });

  it("handles the nightStartHour boundary — exactly at nightStartHour", () => {
    const shift = d(2026, 6, 24, 18, 0); // 6pm
    expect(businessDateForShift(shift, NIGHT_START)).toBe("2026-07-24");
  });

  it("handles midnight boundary (0:00 before night start)", () => {
    const shift = d(2026, 6, 25, 0, 0);
    expect(businessDateForShift(shift, NIGHT_START)).toBe("2026-07-24");
  });

  it("handles early afternoon (before night start, but not overnight)", () => {
    const shift = d(2026, 6, 24, 14, 0); // 2pm
    expect(businessDateForShift(shift, NIGHT_START)).toBe("2026-07-23"); // previous day
  });
});

// ── isOvernightShift ──────────────────────────────────────────────

describe("isOvernightShift", () => {
  it("returns true for shifts spanning midnight", () => {
    expect(isOvernightShift("22:00", "04:00")).toBe(true);
  });

  it("returns false for same-day shifts", () => {
    expect(isOvernightShift("14:00", "22:00")).toBe(false);
  });

  it("returns true when end equals start (24h shift)", () => {
    expect(isOvernightShift("22:00", "22:00")).toBe(true);
  });

  it("returns true for shifts ending just before start time", () => {
    expect(isOvernightShift("23:00", "01:00")).toBe(true);
  });
});

// ── generateShiftsFromTemplates ───────────────────────────────────

describe("generateShiftsFromTemplates", () => {
  const NIGHT_START = 18;
  const templates: ShiftTemplate[] = [
    { id: "tpl-fri-sofia", venueId: "venue-1", staffId: "st-sofia", dayOfWeek: 5, startTime: "22:00", endTime: "06:00", zoneId: "zone-bar", role: "bartender", active: true },
    { id: "tpl-fri-amara", venueId: "venue-1", staffId: "st-amara", dayOfWeek: 5, startTime: "21:00", endTime: "06:00", zoneId: null, role: "manager", active: true },
    { id: "tpl-sat-sofia", venueId: "venue-1", staffId: "st-sofia", dayOfWeek: 6, startTime: "22:00", endTime: "06:00", zoneId: "zone-bar", role: "bartender", active: true },
    { id: "tpl-inactive", venueId: "venue-1", staffId: "st-theo", dayOfWeek: 5, startTime: "22:00", endTime: "06:00", zoneId: null, role: "bartender", active: false },
  ];

  it("generates shifts for a full week starting Monday", () => {
    // 2026-07-20 is a Monday (day 1)
    const weekStart = new Date("2026-07-20T00:00:00-04:00");
    const shifts = generateShiftsFromTemplates(templates, weekStart, NIGHT_START);

    // 2 active templates for Friday (dayOfWeek 5) + 1 for Saturday (dayOfWeek 6)
    expect(shifts).toHaveLength(3);

    const fridayShifts = shifts.filter((s) => s.businessDate === "2026-07-24");
    expect(fridayShifts).toHaveLength(2);
    expect(fridayShifts.map((s) => s.staffId).sort()).toEqual(["st-amara", "st-sofia"]);

    const satShifts = shifts.filter((s) => s.businessDate === "2026-07-25");
    expect(satShifts).toHaveLength(1);
    expect(satShifts[0].staffId).toBe("st-sofia");
  });

  it("all generated shifts have draft status", () => {
    const weekStart = new Date("2026-07-20T00:00:00-04:00");
    const shifts = generateShiftsFromTemplates(templates, weekStart, NIGHT_START);
    for (const s of shifts) {
      expect(s.status).toBe("draft");
    }
  });

  it("skips inactive templates", () => {
    const weekStart = new Date("2026-07-20T00:00:00-04:00");
    const shifts = generateShiftsFromTemplates(templates, weekStart, NIGHT_START);
    expect(shifts.find((s) => s.staffId === "st-theo")).toBeUndefined();
  });

  it("assigns templateId to track origin", () => {
    const weekStart = new Date("2026-07-20T00:00:00-04:00");
    const shifts = generateShiftsFromTemplates(templates, weekStart, NIGHT_START);
    for (const s of shifts) {
      expect(s.templateId).toBeDefined();
    }
  });

  it("handles empty templates", () => {
    const weekStart = new Date("2026-07-20T00:00:00-04:00");
    expect(generateShiftsFromTemplates([], weekStart, NIGHT_START)).toHaveLength(0);
  });
});
