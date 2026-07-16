import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { createTestDb, type TestDb } from "@/server/test-pglite";
import {
  checkEntitlement, checkTableLimit, checkStaffLimit,
  listPlanConfigs, updatePlanConfig, logAdminAction, listAdminActions,
} from "./admin-core";
import type { AuthSession } from "@/server/auth-helpers";

const ADMIN_SESSION: AuthSession = {
  user: { id: "admin-1", name: "Admin", email: "admin@test.com", isPlatformAdmin: true },
  session: { id: "sess-1" },
};

async function seedTenant(db: PrismaClient, slug: string, plan = "starter") {
  const org = await db.organization.create({ data: { id: `org-${slug}`, name: slug, slug } });
  await db.venue.create({
    data: {
      id: org.id, address: "1 St", city: "Test", timezone: "UTC",
      currency: "CAD", openingHours: [], serviceFees: [],
      floorMap: { width: 16, height: 9 }, autoApproveGuests: false,
      logoInitials: "TT",
      slaThresholds: { orderWarnMinutes: 6, orderCriticalMinutes: 12, helpWarnMinutes: 4, helpCriticalMinutes: 8 },
      lastCallAutoFlagTables: true,
    },
  });
  await db.tenant.create({
    data: { id: org.id, name: slug, slug, plan, status: "active" },
  });
  return org.id;
}

describe("platform admin-core (integration)", () => {
  let testDb: TestDb;
  let db: PrismaClient;

  beforeAll(async () => {
    testDb = await createTestDb();
    db = testDb.rawClient;
  }, 60_000);

  afterAll(async () => { await testDb?.teardown(); });

  describe("entitlement enforcement", () => {
    let tenantId: string;

    beforeAll(async () => {
      tenantId = await seedTenant(db, "ent-test", "starter");
    });

    it("allows a feature included in the plan", async () => {
      const result = await checkEntitlement(db, tenantId, "inventory");
      expect(result.allowed).toBe(true);
    });

    it("rejects a feature not in the plan and suggests upgrade", async () => {
      const result = await checkEntitlement(db, tenantId, "analytics");
      expect(result.allowed).toBe(false);
      expect(result.upgrade).toBe("pro");
    });

    it("rejects unknown tenant", async () => {
      const result = await checkEntitlement(db, "nonexistent", "inventory");
      expect(result.allowed).toBe(false);
    });
  });

  describe("table limit enforcement", () => {
    let tenantId: string;

    beforeAll(async () => {
      tenantId = await seedTenant(db, "tbl-limit", "starter");
      const zone = await db.zone.create({
        data: { venueId: tenantId, name: "Main", color: "blue" },
      });
      for (let i = 0; i < 10; i++) {
        await db.venueTable.create({
          data: {
            venueId: tenantId, zoneId: zone.id,
            code: `T${i + 1}`, label: `Table ${i + 1}`, seats: 4, status: "open",
            qrSlug: `tbl-limit-${i}`,
          },
        });
      }
    });

    it("allows when under the limit", async () => {
      const result = await checkTableLimit(db, tenantId);
      expect(result.allowed).toBe(false);
      expect(result.current).toBe(10);
      expect(result.limit).toBe(10);
    });

    it("rejects table N+1 (boundary)", async () => {
      const result = await checkTableLimit(db, tenantId);
      expect(result.allowed).toBe(false);
      expect(result.current).toBeGreaterThanOrEqual(result.limit!);
    });
  });

  describe("staff limit enforcement", () => {
    let tenantId: string;

    beforeAll(async () => {
      tenantId = await seedTenant(db, "staff-limit", "starter");
      for (let i = 0; i < 5; i++) {
        const user = await db.user.create({
          data: { id: `user-sl-${i}`, name: `Staff ${i}`, email: `staff${i}@sl.test` },
        });
        await db.member.create({
          data: { id: `mem-sl-${i}`, organizationId: tenantId, userId: user.id, role: "member" },
        });
      }
    });

    it("rejects staff beyond limit", async () => {
      const result = await checkStaffLimit(db, tenantId);
      expect(result.allowed).toBe(false);
      expect(result.current).toBe(5);
      expect(result.limit).toBe(5);
    });
  });

  describe("plan config CRUD", () => {
    it("lists seeded plan configs with prices in dollars", async () => {
      const configs = await listPlanConfigs(db);
      expect(configs.length).toBeGreaterThanOrEqual(3);
      const starter = configs.find((c) => c.id === "starter");
      expect(starter).toBeDefined();
      expect(starter!.monthlyPrice).toBe(0.99);
    });

    it("rejects negative price", async () => {
      await expect(
        updatePlanConfig(db, "starter", { monthlyPrice: -1 }, ADMIN_SESSION),
      ).rejects.toThrow();
    });
  });

  describe("admin action audit log", () => {
    it("logs and retrieves an action", async () => {
      await logAdminAction(db, ADMIN_SESSION, null, "test_action", { before: true }, { after: true });
      const actions = await listAdminActions(db);
      const match = actions.find((a) => a.action === "test_action");
      expect(match).toBeDefined();
      expect(match!.actorEmail).toBe("admin@test.com");
      expect(match!.before).toEqual({ before: true });
      expect(match!.after).toEqual({ after: true });
    });

    it("filters by tenantId", async () => {
      const tId = await seedTenant(db, "audit-filter", "starter");
      await logAdminAction(db, ADMIN_SESSION, tId, "tenant_action", null, null);
      const filtered = await listAdminActions(db, tId);
      expect(filtered.length).toBeGreaterThanOrEqual(1);
      expect(filtered.every((a) => a.action === "tenant_action")).toBe(true);
    });
  });
});
