import { describe, it, expect } from "vitest";
import { mergePermissions, computeDeltas } from "@/features/platform/permission-core";
import { DEFAULT_ROLE_PERMISSIONS } from "@/features/shared/permissions";
import type { StaffAction } from "@/features/shared/permissions";

describe("mergePermissions", () => {
  it("returns defaults when no rows are stored", () => {
    const result = mergePermissions([]);
    expect(result).toEqual(DEFAULT_ROLE_PERMISSIONS);
  });

  it("overlays a stored row on top of defaults", () => {
    const customRunner: StaffAction[] = ["order:claim", "order:release"];
    const result = mergePermissions([{ role: "runner", actions: customRunner }]);

    // Runner should be overridden.
    expect(result.runner).toEqual(customRunner);
    // Other roles should still match defaults.
    expect(result.manager).toEqual(DEFAULT_ROLE_PERMISSIONS.manager);
    expect(result.bartender).toEqual(DEFAULT_ROLE_PERMISSIONS.bartender);
    expect(result.host).toEqual(DEFAULT_ROLE_PERMISSIONS.host);
    expect(result.security).toEqual(DEFAULT_ROLE_PERMISSIONS.security);
    expect(result.promoter).toEqual(DEFAULT_ROLE_PERMISSIONS.promoter);
  });

  it("overlays multiple stored rows", () => {
    const rows = [
      { role: "runner" as const, actions: ["order:claim"] as StaffAction[] },
      { role: "host" as const, actions: ["order:accept"] as StaffAction[] },
    ];
    const result = mergePermissions(rows);
    expect(result.runner).toEqual(["order:claim"]);
    expect(result.host).toEqual(["order:accept"]);
    expect(result.manager).toEqual(DEFAULT_ROLE_PERMISSIONS.manager);
  });

  it("returns a clone, not a shared reference", () => {
    const result1 = mergePermissions([]);
    const result2 = mergePermissions([]);
    expect(result1).not.toBe(result2);
    expect(result1.manager).not.toBe(result2.manager);
    // Mutating one should not affect the other.
    result1.manager = [];
    expect(result2.manager).toEqual(DEFAULT_ROLE_PERMISSIONS.manager);
  });
});

describe("computeDeltas", () => {
  it("returns empty when permissions match defaults exactly", () => {
    const deltas = computeDeltas(structuredClone(DEFAULT_ROLE_PERMISSIONS));
    expect(deltas).toEqual([]);
  });

  it("returns a delta for a role that differs", () => {
    const modified = structuredClone(DEFAULT_ROLE_PERMISSIONS);
    modified.runner = ["order:claim"];
    const deltas = computeDeltas(modified);
    expect(deltas).toEqual([{ role: "runner", actions: ["order:claim"] }]);
  });

  it("returns multiple deltas", () => {
    const modified = structuredClone(DEFAULT_ROLE_PERMISSIONS);
    modified.runner = ["order:claim"];
    modified.host = ["order:accept"];
    const deltas = computeDeltas(modified);
    expect(deltas).toHaveLength(2);
    expect(deltas).toContainEqual({ role: "runner", actions: ["order:claim"] });
    expect(deltas).toContainEqual({ role: "host", actions: ["order:accept"] });
  });

  it("treats same actions in different order as equal (no delta)", () => {
    const modified = structuredClone(DEFAULT_ROLE_PERMISSIONS);
    // Reverse the default runner actions.
    modified.runner = [...DEFAULT_ROLE_PERMISSIONS.runner].reverse();
    const deltas = computeDeltas(modified);
    expect(deltas).toEqual([]);
  });
});
