import { describe, it, expect } from "vitest";
import { normalizeVenueLocale } from "./locale";

describe("normalizeVenueLocale", () => {
  it("maps fr and en through unchanged", () => {
    expect(normalizeVenueLocale("fr")).toBe("fr");
    expect(normalizeVenueLocale("en")).toBe("en");
  });

  it("defaults everything else (including null/undefined/empty) to en", () => {
    expect(normalizeVenueLocale("es")).toBe("en");
    expect(normalizeVenueLocale(null)).toBe("en");
    expect(normalizeVenueLocale(undefined)).toBe("en");
    expect(normalizeVenueLocale("")).toBe("en");
  });
});
