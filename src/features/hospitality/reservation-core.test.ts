import { describe, it, expect } from "vitest";
import {
  normalizeStatus,
  prismaStatus,
  tableStatusFor,
} from "@/features/hospitality/reservation-core";

// ── normalizeStatus / prismaStatus ──────────────────────────────────

describe("normalizeStatus", () => {
  it("maps Prisma no_show to TS no-show", () => {
    expect(normalizeStatus("no_show")).toBe("no-show");
  });

  it("passes through all other status values unchanged", () => {
    for (const s of ["requested", "confirmed", "seated", "cancelled", "completed"] as const) {
      expect(normalizeStatus(s)).toBe(s);
    }
  });
});

describe("prismaStatus", () => {
  it("maps TS no-show to Prisma no_show", () => {
    expect(prismaStatus("no-show")).toBe("no_show");
  });

  it("passes through all other status values unchanged", () => {
    for (const s of ["requested", "confirmed", "seated", "cancelled", "completed"] as const) {
      expect(prismaStatus(s)).toBe(s);
    }
  });

  it("round-trips: normalizeStatus ∘ prismaStatus = identity for no-show", () => {
    expect(normalizeStatus(prismaStatus("no-show"))).toBe("no-show");
  });

  it("round-trips: prismaStatus ∘ normalizeStatus = identity for no_show", () => {
    expect(prismaStatus(normalizeStatus("no_show"))).toBe("no_show");
  });
});

// ── tableStatusFor ──────────────────────────────────────────────────

describe("tableStatusFor", () => {
  it("confirmed → reserved", () => {
    expect(tableStatusFor("confirmed")).toBe("reserved");
  });

  it("requested → reserved", () => {
    expect(tableStatusFor("requested")).toBe("reserved");
  });

  it("seated → occupied", () => {
    expect(tableStatusFor("seated")).toBe("occupied");
  });

  it("cancelled → open (releases table)", () => {
    expect(tableStatusFor("cancelled")).toBe("open");
  });

  it("completed → open (releases table)", () => {
    expect(tableStatusFor("completed")).toBe("open");
  });

  it("no-show → open (releases table)", () => {
    expect(tableStatusFor("no-show")).toBe("open");
  });

  it("returns null for unknown status", () => {
    expect(tableStatusFor("unknown" as any)).toBeNull();
  });
});
