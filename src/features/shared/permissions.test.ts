import { describe, expect, it } from "vitest";
import {
  canDo,
  getHelpScope,
  DEFAULT_ROLE_PERMISSIONS,
  type ActorContext,
} from "./permissions";

const actor: ActorContext = { staffId: "st-1", assignedZoneIds: ["z-main", "z-vip"] };
const other = "st-2";

describe("canDo — matrix (source-compatible 3-arg form)", () => {
  it("grants an action the role holds", () => {
    expect(canDo(DEFAULT_ROLE_PERMISSIONS, "manager", "tab:void")).toBe(true);
  });

  it("denies an action the role lacks", () => {
    expect(canDo(DEFAULT_ROLE_PERMISSIONS, "runner", "tab:void")).toBe(false);
  });

  it("denies for an unknown role gracefully", () => {
    // @ts-expect-error — exercising the ?? false guard
    expect(canDo(DEFAULT_ROLE_PERMISSIONS, "ghost", "tab:void")).toBe(false);
  });

  it("a scoped action with no ctx returns the plain matrix answer", () => {
    expect(canDo(DEFAULT_ROLE_PERMISSIONS, "promoter", "reservation:edit-own")).toBe(true);
    expect(canDo(DEFAULT_ROLE_PERMISSIONS, "runner", "reservation:edit-own")).toBe(false);
  });
});

describe("canDo — ownership-scoped actions", () => {
  it("still requires the role to hold the action even when the actor owns the resource", () => {
    expect(
      canDo(DEFAULT_ROLE_PERMISSIONS, "runner", "reservation:edit-own", {
        actor,
        resource: { ownerStaffId: actor.staffId },
      }),
    ).toBe(false);
  });

  it("grants edit-own on a resource the actor owns", () => {
    expect(
      canDo(DEFAULT_ROLE_PERMISSIONS, "promoter", "reservation:edit-own", {
        actor,
        resource: { ownerStaffId: actor.staffId },
      }),
    ).toBe(true);
  });

  it("denies edit-own on a resource owned by someone else", () => {
    expect(
      canDo(DEFAULT_ROLE_PERMISSIONS, "promoter", "reservation:edit-own", {
        actor,
        resource: { ownerStaffId: other },
      }),
    ).toBe(false);
  });

  it("denies edit-own when ownership is unknown", () => {
    expect(
      canDo(DEFAULT_ROLE_PERMISSIONS, "promoter", "reservation:edit-own", {
        actor,
        resource: { ownerStaffId: null },
      }),
    ).toBe(false);
  });

  it("cancel-own and confirm-own follow the same ownership rule", () => {
    for (const action of ["reservation:cancel-own", "reservation:confirm-own"] as const) {
      expect(canDo(DEFAULT_ROLE_PERMISSIONS, "promoter", action, { actor, resource: { ownerStaffId: actor.staffId } })).toBe(true);
      expect(canDo(DEFAULT_ROLE_PERMISSIONS, "promoter", action, { actor, resource: { ownerStaffId: other } })).toBe(false);
    }
  });

  it("tips:read-own is scoped to the actor's own share", () => {
    expect(canDo(DEFAULT_ROLE_PERMISSIONS, "bartender", "tips:read-own", { actor, resource: { ownerStaffId: actor.staffId } })).toBe(true);
    expect(canDo(DEFAULT_ROLE_PERMISSIONS, "bartender", "tips:read-own", { actor, resource: { ownerStaffId: other } })).toBe(false);
  });

  it("time:clock-self is scoped to the actor's own entry", () => {
    expect(canDo(DEFAULT_ROLE_PERMISSIONS, "runner", "time:clock-self", { actor, resource: { ownerStaffId: actor.staffId } })).toBe(true);
    expect(canDo(DEFAULT_ROLE_PERMISSIONS, "runner", "time:clock-self", { actor, resource: { ownerStaffId: other } })).toBe(false);
  });

  it("time:clock-self without a resource means acting on yourself (route calls)", () => {
    expect(canDo(DEFAULT_ROLE_PERMISSIONS, "runner", "time:clock-self", { actor })).toBe(true);
  });

  it("time:edit-others still requires naming the target entry's owner", () => {
    expect(canDo(DEFAULT_ROLE_PERMISSIONS, "manager", "time:edit-others", { actor })).toBe(false);
  });

  it("time:edit-others rejects editing your own entry", () => {
    expect(canDo(DEFAULT_ROLE_PERMISSIONS, "manager", "time:edit-others", { actor, resource: { ownerStaffId: other } })).toBe(true);
    expect(canDo(DEFAULT_ROLE_PERMISSIONS, "manager", "time:edit-others", { actor, resource: { ownerStaffId: actor.staffId } })).toBe(false);
  });
});

describe("canDo — help:respond zone scoping", () => {
  it("manager (scope all) can respond to any request", () => {
    expect(getHelpScope("manager")).toBe("all");
    expect(canDo(DEFAULT_ROLE_PERMISSIONS, "manager", "help:respond", { actor, resource: { zoneId: "z-other", helpType: "security" } })).toBe(true);
  });

  it("host, bartender, runner cannot respond — only security and manager", () => {
    expect(canDo(DEFAULT_ROLE_PERMISSIONS, "host", "help:respond")).toBe(false);
    expect(canDo(DEFAULT_ROLE_PERMISSIONS, "bartender", "help:respond")).toBe(false);
    expect(canDo(DEFAULT_ROLE_PERMISSIONS, "runner", "help:respond")).toBe(false);
  });

  it("security (scope security-only) responds only to security requests", () => {
    expect(getHelpScope("security")).toBe("security-only");
    expect(canDo(DEFAULT_ROLE_PERMISSIONS, "security", "help:respond", { actor, resource: { zoneId: "z-x", helpType: "security" } })).toBe(true);
    expect(canDo(DEFAULT_ROLE_PERMISSIONS, "security", "help:respond", { actor, resource: { zoneId: "z-x", helpType: "call-waiter" } })).toBe(false);
  });

  it("runner (scope assigned-zones) lacks help:respond entirely", () => {
    expect(getHelpScope("runner")).toBe("assigned-zones");
    // Runner no longer holds help:respond — only security and manager do.
    expect(canDo(DEFAULT_ROLE_PERMISSIONS, "runner", "help:respond")).toBe(false);
  });
});
