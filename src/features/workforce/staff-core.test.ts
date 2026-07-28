import { describe, expect, it } from "vitest";
import { staffRoleToOrgRole } from "@/features/workforce/staff-core";

describe("staff access-role mapping", () => {
  it.each([
    ["manager", "admin"],
    ["host", "member"],
    ["bartender", "member"],
    ["runner", "member"],
  ] as const)("maps %s to %s", (floorRole, orgRole) => {
    expect(staffRoleToOrgRole(floorRole)).toBe(orgRole);
  });
});
