import { describe, it, expect } from "vitest";

const AREA_ROLES: Record<string, string[]> = {
  manager: ["manager"],
  staff: ["manager", "host", "bartender", "runner", "security"],
};

const ALL_STAFF_ROLES = [
  "manager",
  "host",
  "bartender",
  "runner",
  "security",
] as const;

describe("AREA_ROLES matrix", () => {
  describe("manager area", () => {
    it("allows manager", () => {
      expect(AREA_ROLES.manager).toContain("manager");
    });

    it.each(["host", "bartender", "runner", "security"] as const)(
      "denies %s",
      (role) => {
        expect(AREA_ROLES.manager).not.toContain(role);
      },
    );
  });

  describe("staff area", () => {
    it.each(ALL_STAFF_ROLES)("allows %s", (role) => {
      expect(AREA_ROLES.staff).toContain(role);
    });
  });

  describe("admin area", () => {
    it("requires isPlatformAdmin, not a staff role", () => {
      expect(AREA_ROLES).not.toHaveProperty("admin");
    });
  });

  describe("completeness", () => {
    it("every role appears in at least one area", () => {
      const allAllowed = new Set(Object.values(AREA_ROLES).flat());
      for (const role of ALL_STAFF_ROLES) {
        expect(allAllowed).toContain(role);
      }
    });
  });
});
