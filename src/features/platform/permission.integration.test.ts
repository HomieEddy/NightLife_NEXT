import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getDb, type SessionContext } from "@/features/shared/db";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";
import {
  getRolePermissions,
  setRolePermissions,
  resetRolePermissions,
  mergePermissions,
  computeDeltas,
} from "@/features/platform/permission-core";
import { DEFAULT_ROLE_PERMISSIONS, canDo } from "@/features/shared/permissions";
import { expectTenantIsolation } from "@/features/shared/test-helpers";

async function makeVenue(rawClient: PrismaClient, name: string, slug: string) {
  const org = await rawClient.organization.create({ data: { id: `org-${slug}`, name, slug } });
  await rawClient.venue.create({
    data: {
      id: org.id, address: "1 Test St", city: "Testville",
      timezone: "America/Montreal", currency: "CAD",
      openingHours: [], serviceFees: [],
      floorMap: { width: 16, height: 9 },
      autoApproveGuests: false, logoInitials: "TT",
      slaThresholds: { orderWarnMinutes: 6, orderCriticalMinutes: 12, helpWarnMinutes: 4, helpCriticalMinutes: 8 },
      lastCallAutoFlagTables: true,
    },
  });
  return org.id;
}

describe("permission persistence (WS-6)", () => {
  let testDb: TestDb;
  let rawClient: PrismaClient;
  let venueA: string;
  let venueB: string;
  let dbA: ReturnType<typeof getDb>;
  let dbB: ReturnType<typeof getDb>;

  beforeAll(async () => {
    testDb = await createTestDb();
    rawClient = testDb.rawClient;
    venueA = await makeVenue(rawClient, "Venue A", "perm-int-a");
    venueB = await makeVenue(rawClient, "Venue B", "perm-int-b");
    dbA = getDb({ venueId: venueA });
    dbB = getDb({ venueId: venueB });
  }, 60_000);

  afterAll(async () => {
    await testDb?.teardown();
  });

  describe("getRolePermissions", () => {
    it("returns defaults when no overrides are stored", async () => {
      const permissions = await getRolePermissions(dbA);
      expect(permissions).toEqual(DEFAULT_ROLE_PERMISSIONS);
    });

    it("returns a clone, not a shared reference", async () => {
      const a = await getRolePermissions(dbA);
      const b = await getRolePermissions(dbA);
      expect(a).not.toBe(b);
      expect(a.manager).not.toBe(b.manager);
    });
  });

  describe("setRolePermissions", () => {
    it("persists a custom override and returns it on next read", async () => {
      const modified = structuredClone(DEFAULT_ROLE_PERMISSIONS);
      modified.runner = ["order:claim"];

      const { previous, next } = await setRolePermissions(dbA, modified);
      expect(previous).toEqual(DEFAULT_ROLE_PERMISSIONS);
      expect(next.runner).toEqual(["order:claim"]);

      // Read back from DB.
      const reloaded = await getRolePermissions(dbA);
      expect(reloaded.runner).toEqual(["order:claim"]);
    });

    it("stores only deltas from defaults", async () => {
      const modified = structuredClone(DEFAULT_ROLE_PERMISSIONS);
      modified.host = ["order:accept"];

      await setRolePermissions(dbA, modified);

      // Check raw rows — only the host delta should be stored.
      const rows = await rawClient.venueRolePermissions.findMany({
        where: { venueId: venueA },
      });
      const hostRow = rows.find((r) => r.role === "host");
      expect(hostRow).toBeDefined();
      expect(hostRow!.actions).toEqual(["order:accept"]);

      // Manager matches defaults — no row stored.
      const managerRow = rows.find((r) => r.role === "manager");
      expect(managerRow).toBeUndefined();
    });

    it("removes a row when role is restored to defaults", async () => {
      // First set a custom override.
      const withOverride = structuredClone(DEFAULT_ROLE_PERMISSIONS);
      withOverride.bartender = ["order:claim"];
      await setRolePermissions(dbA, withOverride);

      // Now set back to defaults (no overrides).
      await setRolePermissions(dbA, structuredClone(DEFAULT_ROLE_PERMISSIONS));

      const rows = await rawClient.venueRolePermissions.findMany({
        where: { venueId: venueA },
      });
      expect(rows).toEqual([]);
    });
  });

  describe("resetRolePermissions", () => {
    it("removes all overrides and returns defaults", async () => {
      // Set some custom overrides.
      const modified = structuredClone(DEFAULT_ROLE_PERMISSIONS);
      modified.runner = ["order:claim"];
      modified.host = ["order:accept"];
      await setRolePermissions(dbA, modified);

      const { previous, next } = await resetRolePermissions(dbA);
      expect(previous.runner).toEqual(["order:claim"]);
      expect(previous.host).toEqual(["order:accept"]);
      expect(next).toEqual(DEFAULT_ROLE_PERMISSIONS);

      // DB should be clean.
      const rows = await rawClient.venueRolePermissions.findMany({
        where: { venueId: venueA },
      });
      expect(rows).toEqual([]);
    });
  });

  describe("expectTenantIsolation", () => {
    it("isolates venue A overrides from venue B", async () => {
      // Set override for venue A only.
      const modifiedA = structuredClone(DEFAULT_ROLE_PERMISSIONS);
      modifiedA.promoter = ["order:claim"];
      await setRolePermissions(dbA, modifiedA);

      // Venue B still sees defaults.
      const permissionsB = await getRolePermissions(dbB);
      expect(permissionsB).toEqual(DEFAULT_ROLE_PERMISSIONS);

      // Clean up A.
      await resetRolePermissions(dbA);
    });
  });

  describe("role enforcement (plan 15 §5)", () => {
    it("grants order:claim to runner with default permissions", async () => {
      // Reset to defaults first.
      await resetRolePermissions(dbA);
      const permissions = await getRolePermissions(dbA);
      expect(canDo(permissions, "runner", "order:claim")).toBe(true);
    });

    it("denies order:claim to runner after permission is removed", async () => {
      const modified = structuredClone(DEFAULT_ROLE_PERMISSIONS);
      modified.runner = DEFAULT_ROLE_PERMISSIONS.runner.filter((a) => a !== "order:claim");
      await setRolePermissions(dbA, modified);

      const permissions = await getRolePermissions(dbA);
      expect(canDo(permissions, "runner", "order:claim")).toBe(false);
      // Runner still has release and transition.
      expect(canDo(permissions, "runner", "order:release")).toBe(true);
      expect(canDo(permissions, "runner", "order:transition")).toBe(true);

      // Clean up.
      await resetRolePermissions(dbA);
    });

    it("denies order:accept to runner (default behaviour)", async () => {
      const permissions = await getRolePermissions(dbA);
      expect(canDo(permissions, "runner", "order:accept")).toBe(false);
    });

    it("denies session:approve to bartender (default behaviour)", async () => {
      const permissions = await getRolePermissions(dbA);
      expect(canDo(permissions, "bartender", "session:approve")).toBe(false);
    });

    it("denies order:gift to runner (default behaviour)", async () => {
      const permissions = await getRolePermissions(dbA);
      expect(canDo(permissions, "runner", "order:gift")).toBe(false);
    });

    it("grants session:deny to host (default behaviour)", async () => {
      const permissions = await getRolePermissions(dbA);
      expect(canDo(permissions, "host", "session:deny")).toBe(true);
    });

    it("stores manager overrides — the API is permissive, only the UI locks manager", async () => {
      await resetRolePermissions(dbA);
      // Manager is NOT force-granted at this layer: setRolePermissions will
      // happily strip manager actions. The manager lock lives in RolesAccessTab
      // (UI), not in canDo/the store — this test pins that real behaviour.
      const modified = structuredClone(DEFAULT_ROLE_PERMISSIONS);
      modified.manager = ["order:claim"]; // Strip everything but claim.
      await setRolePermissions(dbA, modified);

      const permissions = await getRolePermissions(dbA);
      expect(canDo(permissions, "manager", "order:claim")).toBe(true);
      expect(canDo(permissions, "manager", "order:gift")).toBe(false);
      // The UI (RolesAccessTab) enforces manager lock — the API is permissive
      // so a future tenant admin tool could still customize manager actions.

      await resetRolePermissions(dbA);
    });

    it("returns false for unknown actions", async () => {
      const permissions = await getRolePermissions(dbA);
      expect(canDo(permissions, "runner", "nonexistent:action" as never)).toBe(false);
    });
  });
});
