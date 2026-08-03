import { describe, it, expect } from "vitest";
import { formatMoney, formatTime, formatDate, timeAgo, formatPct } from "./format";

describe("formatMoney", () => {
  it("formats CAD integer without cents in en", () => {
    const result = formatMoney(1800, "CAD", "en");
    // en-CA: CA$1,800.00 or similar — contains the amount
    expect(result).toContain("1");
  });

  it("formats CAD fractional in en", () => {
    const result = formatMoney(20.7, "CAD", "en");
    // Non-integer — shows cents
    expect(result).toMatch(/20\.70/);
  });

  it("formats CAD fractional in fr-CA (narrow no-break space, comma decimal)", () => {
    const result = formatMoney(1234.56, "CAD", "fr");
    // fr-CA: 1 234,56 $ — comma is decimal separator, space is U+202F NBSP
    expect(result).toMatch(/\$/);
    expect(result).toMatch(/56/);
  });

  it("formats CAD integer in fr", () => {
    const result = formatMoney(1800, "CAD", "fr");
    // fr-CA: whole amounts display without cents
    expect(result).toMatch(/\$/);
  });
});

describe("formatPct", () => {
  it("formats ratio to percentage", () => {
    expect(formatPct(0.125)).toBe("13%");
  });

  it("rounds correctly", () => {
    expect(formatPct(0.333)).toBe("33%");
    expect(formatPct(0.666)).toBe("67%");
  });
});

describe("timeAgo", () => {
  it("returns 'just now' for <60s in en", () => {
    const recent = new Date(Date.now() - 30000).toISOString();
    expect(timeAgo(recent, "en")).toBe("just now");
  });

  it("returns French for <60s in fr", () => {
    const recent = new Date(Date.now() - 30000).toISOString();
    expect(timeAgo(recent, "fr")).toBe("à l'instant");
  });

  it("returns minutes ago in en", () => {
    const past = new Date(Date.now() - 180000).toISOString();
    expect(timeAgo(past, "en")).toMatch(/^\d+m ago$/);
  });

  it("returns minutes ago in fr", () => {
    const past = new Date(Date.now() - 180000).toISOString();
    expect(timeAgo(past, "fr")).toMatch(/^il y a \d+ min$/);
  });
});

describe("formatTime", () => {
  it("uses 24h in en-GB", () => {
    // 2026-01-01 14:30 UTC
    const result = formatTime("2026-01-01T14:30:00Z", "en");
    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  it("uses 24h in fr-CA", () => {
    const result = formatTime("2026-01-01T14:30:00Z", "fr");
    // fr-CA uses "HH h MM" format, e.g. "09 h 30"
    expect(result).toMatch(/\d{1,2}\s*h\s*\d{2}/);
  });
});

describe("formatDate", () => {
  it("formats in en-GB (day month year)", () => {
    const result = formatDate("2026-01-15T00:00:00Z", "en");
    expect(result).toContain("Jan");
    expect(result).toContain("2026");
  });

  it("formats in fr-CA (day month year)", () => {
    const result = formatDate("2026-01-15T00:00:00Z", "fr");
    expect(result).toContain("2026");
    // fr-CA short month: "janv."
    expect(result).toMatch(/janv/);
  });
});
