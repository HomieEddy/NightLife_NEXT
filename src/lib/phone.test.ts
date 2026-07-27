import { describe, it, expect } from "vitest";
import { normalizePhone, formatPhone } from "./phone";

describe("normalizePhone", () => {
  it("formats a 10-digit NANP number", () => {
    expect(normalizePhone("5145550234")).toBe("+15145550234");
  });

  it("strips spaces, dashes and parens", () => {
    expect(normalizePhone("(514) 555-0234")).toBe("+15145550234");
    expect(normalizePhone("514-555-0234")).toBe("+15145550234");
  });

  it("accepts an already-normalized E.164 number", () => {
    expect(normalizePhone("+15145550234")).toBe("+15145550234");
  });

  it("normalizes 11-digit numbers starting with 1", () => {
    expect(normalizePhone("15145550234")).toBe("+15145550234");
  });

  it("returns null for garbage input", () => {
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});

describe("formatPhone", () => {
  it("renders a NANP E.164 number spaced for reading", () => {
    expect(formatPhone("+15145550234")).toBe("(514) 555-0234");
  });

  it("passes through non-NANP numbers unchanged", () => {
    expect(formatPhone("+447911123456")).toBe("+447911123456");
  });
});
