import { describe, it, expect } from "vitest";
import { nightContaining, nightForDate } from "./night";

describe("nightForDate", () => {
  it("returns 18:00→10:00 UTC for a UTC timezone", () => {
    const b = nightForDate("2026-07-14", "UTC");
    expect(b.label).toBe("2026-07-14");
    expect(b.start.toISOString()).toBe("2026-07-14T18:00:00.000Z");
    expect(b.end.toISOString()).toBe("2026-07-15T10:00:00.000Z");
  });

  it("offsets correctly for America/Montreal (UTC-4 in summer)", () => {
    const b = nightForDate("2026-07-14", "America/Montreal");
    // 18:00 EDT = 22:00 UTC
    expect(b.start.toISOString()).toBe("2026-07-14T22:00:00.000Z");
    // 10:00 EDT next day = 14:00 UTC
    expect(b.end.toISOString()).toBe("2026-07-15T14:00:00.000Z");
  });

  it("offsets correctly for Europe/Paris (UTC+2 in summer)", () => {
    const b = nightForDate("2026-07-14", "Europe/Paris");
    // 18:00 CEST = 16:00 UTC
    expect(b.start.toISOString()).toBe("2026-07-14T16:00:00.000Z");
    // 10:00 CEST next day = 08:00 UTC
    expect(b.end.toISOString()).toBe("2026-07-15T08:00:00.000Z");
  });

  it("handles winter offset for America/Montreal (UTC-5)", () => {
    const b = nightForDate("2026-01-10", "America/Montreal");
    // 18:00 EST = 23:00 UTC
    expect(b.start.toISOString()).toBe("2026-01-10T23:00:00.000Z");
    // 10:00 EST next day = 15:00 UTC
    expect(b.end.toISOString()).toBe("2026-01-11T15:00:00.000Z");
  });

  it("handles DST spring-forward (March 2026, America/Montreal)", () => {
    // DST springs forward on 2026-03-08 at 02:00 → 03:00
    // Night of March 7: 18:00 EST (UTC-5) → 10:00 EDT (UTC-4) March 8
    const b = nightForDate("2026-03-07", "America/Montreal");
    expect(b.start.toISOString()).toBe("2026-03-07T23:00:00.000Z"); // 18:00 EST
    expect(b.end.toISOString()).toBe("2026-03-08T14:00:00.000Z"); // 10:00 EDT
  });

  it("handles DST fall-back (November 2026, America/Montreal)", () => {
    // DST falls back on 2026-11-01 at 02:00 → 01:00
    // Night of Oct 31: 18:00 EDT (UTC-4) → 10:00 EST (UTC-5) Nov 1
    const b = nightForDate("2026-10-31", "America/Montreal");
    expect(b.start.toISOString()).toBe("2026-10-31T22:00:00.000Z"); // 18:00 EDT
    expect(b.end.toISOString()).toBe("2026-11-01T15:00:00.000Z"); // 10:00 EST
  });
});

describe("nightContaining", () => {
  it("maps a 21:00 local instant to that evening's night", () => {
    // 21:00 EDT on July 14 = 01:00 UTC July 15
    const instant = new Date("2026-07-15T01:00:00Z");
    const b = nightContaining(instant, "America/Montreal");
    expect(b.label).toBe("2026-07-14");
  });

  it("maps a 02:00 local instant to the previous evening's night", () => {
    // 02:00 EDT on July 15 = 06:00 UTC July 15
    const instant = new Date("2026-07-15T06:00:00Z");
    const b = nightContaining(instant, "America/Montreal");
    expect(b.label).toBe("2026-07-14");
  });

  it("maps a 09:59 local instant to the previous evening's night", () => {
    // 09:59 EDT on July 15 = 13:59 UTC
    const instant = new Date("2026-07-15T13:59:00Z");
    const b = nightContaining(instant, "America/Montreal");
    expect(b.label).toBe("2026-07-14");
  });

  it("maps a 10:00 local instant to that day's (upcoming) night", () => {
    // 10:00 EDT on July 15 = 14:00 UTC — this is the boundary, belongs to July 15's night
    const instant = new Date("2026-07-15T14:00:00Z");
    const b = nightContaining(instant, "America/Montreal");
    expect(b.label).toBe("2026-07-15");
  });

  it("maps an 18:00 local instant to that evening's night", () => {
    // 18:00 EDT on July 14 = 22:00 UTC
    const instant = new Date("2026-07-14T22:00:00Z");
    const b = nightContaining(instant, "America/Montreal");
    expect(b.label).toBe("2026-07-14");
  });

  it("produces the same boundary as nightForDate for the same label", () => {
    const instant = new Date("2026-07-15T01:00:00Z"); // 21:00 EDT July 14
    const fromContaining = nightContaining(instant, "America/Montreal");
    const fromDate = nightForDate("2026-07-14", "America/Montreal");
    expect(fromContaining.start.toISOString()).toBe(fromDate.start.toISOString());
    expect(fromContaining.end.toISOString()).toBe(fromDate.end.toISOString());
  });

  it("handles UTC timezone directly", () => {
    const instant = new Date("2026-07-14T23:00:00Z");
    const b = nightContaining(instant, "UTC");
    expect(b.label).toBe("2026-07-14");
    expect(b.start.toISOString()).toBe("2026-07-14T18:00:00.000Z");
  });
});
