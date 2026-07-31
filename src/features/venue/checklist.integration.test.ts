import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "@/features/shared/db";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";
import { expectTenantIsolation } from "@/features/shared/test-helpers";
import {
  listTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate,
  listRuns, getRun, startRun, checkItem, completeRun, skipRun,
} from "@/features/venue/checklist-core";

describe("checklist integration", () => {
  let testDb: TestDb;
  let venueA: string;
  let venueB: string;

  beforeAll(async () => {
    testDb = await createTestDb();
    const rawClient = testDb.rawClient;
    const orgA = await rawClient.organization.create({ data: { id: "org-cl-a", name: "CL Venue A", slug: "cl-venue-a" } });
    const orgB = await rawClient.organization.create({ data: { id: "org-cl-b", name: "CL Venue B", slug: "cl-venue-b" } });
    venueA = orgA.id;
    venueB = orgB.id;
    await rawClient.venue.create({
      data: {
        id: venueA, address: "1 Test St", city: "Testville",
        timezone: "America/Montreal", currency: "CAD",
        openingHours: [], serviceFees: [],
        floorMap: { width: 16, height: 9 },
        autoApproveGuests: false, logoInitials: "CA",
        slaThresholds: { orderWarnMinutes: 6, orderCriticalMinutes: 12, helpWarnMinutes: 4, helpCriticalMinutes: 8 },
        lastCallAutoFlagTables: true,
      },
    });
    await rawClient.venue.create({
      data: {
        id: venueB, address: "2 Test St", city: "Testville",
        timezone: "America/Montreal", currency: "CAD",
        openingHours: [], serviceFees: [],
        floorMap: { width: 16, height: 9 },
        autoApproveGuests: false, logoInitials: "CB",
        slaThresholds: { orderWarnMinutes: 6, orderCriticalMinutes: 12, helpWarnMinutes: 4, helpCriticalMinutes: 8 },
        lastCallAutoFlagTables: true,
      },
    });
  }, 60_000);

  afterAll(async () => {
    await testDb?.teardown();
  });

  // ── Templates ─────────────────────────────────────────────────

  describe("templates", () => {
    it("creates and lists templates", async () => {
      const db = getDb({ venueId: venueA });
      const t = await createTemplate(db, {
        name: "Opening Checklist",
        type: "opening",
        active: true,
        items: [{ id: "it-1", label: "Unlock doors", required: true }],
      });
      expect(t.name).toBe("Opening Checklist");
      expect(t.type).toBe("opening");

      const list = await listTemplates(db);
      expect(list.some((x) => x.id === t.id)).toBe(true);
    });

    it("filters templates by type", async () => {
      const db = getDb({ venueId: venueA });
      const a = await listTemplates(db, "opening");
      const b = await listTemplates(db, "closing");
      expect(a.every((t) => t.type === "opening")).toBe(true);
      expect(b.every((t) => t.type === "closing")).toBe(true);
    });

    it("gets a single template", async () => {
      const db = getDb({ venueId: venueA });
      const created = await createTemplate(db, {
        name: "Get Test", type: "closing", active: true, items: [],
      });
      const found = await getTemplate(db, created.id);
      expect(found?.name).toBe("Get Test");
    });

    it("returns null for unknown template", async () => {
      const db = getDb({ venueId: venueA });
      const found = await getTemplate(db, "nonexistent");
      expect(found).toBeNull();
    });

    it("updates a template", async () => {
      const db = getDb({ venueId: venueA });
      const created = await createTemplate(db, {
        name: "Before Update", type: "opening", active: true, items: [],
      });
      const updated = await updateTemplate(db, created.id, { name: "After Update" });
      expect(updated?.name).toBe("After Update");
    });

    it("deletes a template", async () => {
      const db = getDb({ venueId: venueA });
      const created = await createTemplate(db, {
        name: "To Delete", type: "closing", active: true, items: [],
      });
      await deleteTemplate(db, created.id);
      const found = await getTemplate(db, created.id);
      expect(found).toBeNull();
    });

    it("isolates templates by tenant", async () => {
      const dbA = getDb({ venueId: venueA });
      const t = await createTemplate(dbA, {
        name: "Tenant Iso Template", type: "opening", active: true, items: [],
      });
      await expectTenantIsolation(venueA, venueB, async (db) => {
        const found = await getTemplate(db, t.id);
        return found;
      });
    });
  });

  // ── Runs ──────────────────────────────────────────────────────

  describe("runs", () => {
    let templateId: string;

    beforeAll(async () => {
      const db = getDb({ venueId: venueA });
      const t = await createTemplate(db, {
        name: "Run Test Template",
        type: "opening",
        active: true,
        items: [
          { id: "ri-1", label: "Required item 1", required: true },
          { id: "ri-2", label: "Required item 2", required: true },
          { id: "ri-3", label: "Optional item", required: false },
        ],
      });
      templateId = t.id;
    });

    it("starts a run from a template", async () => {
      const db = getDb({ venueId: venueA });
      const run = await startRun(db, {
        templateId,
        businessDate: "2026-07-30",
        staffId: "stf-1",
        staffName: "Test Staff",
      });
      expect(run).not.toBeNull();
      expect(run!.status).toBe("in-progress");
      expect(run!.items).toHaveLength(3);
      expect(run!.items.every((i) => !i.checked)).toBe(true);
    });

    it("returns null for unknown template", async () => {
      const db = getDb({ venueId: venueA });
      const run = await startRun(db, {
        templateId: "nonexistent",
        businessDate: "2026-07-30",
        staffId: "stf-1",
        staffName: "Test",
      });
      expect(run).toBeNull();
    });

    it("lists runs and filters by type", async () => {
      const db = getDb({ venueId: venueA });
      const all = await listRuns(db);
      expect(all.length).toBeGreaterThanOrEqual(1);
      const opening = await listRuns(db, { type: "opening" });
      expect(opening.every((r) => r.type === "opening")).toBe(true);
    });

    it("filters runs by businessDate", async () => {
      const db = getDb({ venueId: venueA });
      const runs = await listRuns(db, { businessDate: "2026-07-30" });
      expect(runs.every((r) => r.businessDate === "2026-07-30")).toBe(true);
    });

    it("gets a single run", async () => {
      const db = getDb({ venueId: venueA });
      const runs = await listRuns(db);
      const run = await getRun(db, runs[0].id);
      expect(run).not.toBeNull();
      expect(run!.templateName).toBe("Run Test Template");
    });

    it("checks an item", async () => {
      const db = getDb({ venueId: venueA });
      const run = await startRun(db, {
        templateId, businessDate: "2026-07-31",
        staffId: "stf-1", staffName: "Test Staff",
      });
      const updated = await checkItem(db, run!.id, "ri-1", true, "stf-1", "all good");
      expect(updated).not.toBeNull();
      const item = updated!.items.find((i) => i.templateItemId === "ri-1");
      expect(item?.checked).toBe(true);
      expect(item?.note).toBe("all good");
      expect(item?.checkedByStaffId).toBe("stf-1");
    });

    it("unchecks an item", async () => {
      const db = getDb({ venueId: venueA });
      const run = await startRun(db, {
        templateId, businessDate: "2026-07-31",
        staffId: "stf-1", staffName: "Test Staff",
      });
      await checkItem(db, run!.id, "ri-1", true, "stf-1");
      const unchecked = await checkItem(db, run!.id, "ri-1", false, "stf-1");
      expect(unchecked!.items.find((i) => i.templateItemId === "ri-1")?.checked).toBe(false);
    });

    it("blocks completion when required items are unchecked", async () => {
      const db = getDb({ venueId: venueA });
      const run = await startRun(db, {
        templateId, businessDate: "2026-07-31",
        staffId: "stf-1", staffName: "Test Staff",
      });
      const result = await completeRun(db, run!.id, "stf-1", "Test Staff");
      expect(result.ok).toBe(false);
      expect(result.missingItems!.length).toBeGreaterThan(0);
    });

    it("completes a run when all required items are checked", async () => {
      const db = getDb({ venueId: venueA });
      const run = await startRun(db, {
        templateId, businessDate: "2026-08-01",
        staffId: "stf-1", staffName: "Test Staff",
      });
      await checkItem(db, run!.id, "ri-1", true, "stf-1");
      await checkItem(db, run!.id, "ri-2", true, "stf-1");
      const result = await completeRun(db, run!.id, "stf-1", "Test Staff");
      expect(result.ok).toBe(true);

      const completed = await getRun(db, run!.id);
      expect(completed!.status).toBe("completed");
      expect(completed!.completedByStaffName).toBe("Test Staff");
    });

    it("skips a run", async () => {
      const db = getDb({ venueId: venueA });
      const run = await startRun(db, {
        templateId, businessDate: "2026-08-02",
        staffId: "stf-1", staffName: "Test Staff",
      });
      const skipped = await skipRun(db, run!.id);
      expect(skipped).not.toBeNull();
      expect(skipped!.status).toBe("skipped");
    });

    it("cannot check items on a completed run", async () => {
      const db = getDb({ venueId: venueA });
      const run = await startRun(db, {
        templateId, businessDate: "2026-08-03",
        staffId: "stf-1", staffName: "Test Staff",
      });
      await checkItem(db, run!.id, "ri-1", true, "stf-1");
      await checkItem(db, run!.id, "ri-2", true, "stf-1");
      await completeRun(db, run!.id, "stf-1", "Test Staff");

      const result = await checkItem(db, run!.id, "ri-1", false, "stf-1");
      expect(result).toBeNull();
    });

    it("returns null for checkItem on missing item", async () => {
      const db = getDb({ venueId: venueA });
      const run = await startRun(db, {
        templateId, businessDate: "2026-08-04",
        staffId: "stf-1", staffName: "Test Staff",
      });
      const result = await checkItem(db, run!.id, "nonexistent", true, "stf-1");
      expect(result).toBeNull();
    });

    it("cannot complete a non-existent run", async () => {
      const db = getDb({ venueId: venueA });
      const result = await completeRun(db, "nonexistent", "stf-1", "Test");
      expect(result.ok).toBe(false);
    });

    it("isolates runs by tenant", async () => {
      const dbA = getDb({ venueId: venueA });
      const run = await startRun(dbA, {
        templateId, businessDate: "2026-08-05",
        staffId: "stf-1", staffName: "Test Staff",
      });
      await expectTenantIsolation(venueA, venueB, async (db) => {
        const found = await getRun(db, run!.id);
        return found;
      });
    });
  });
});
