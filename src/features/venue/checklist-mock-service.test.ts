import { describe, it, expect, beforeEach } from "vitest";

// Re-import to get fresh module state per test file
// (module-level let resets are handled by vitest module isolation)
const loadService = async () => {
  const mod = await import("./checklist-mock-service");
  return mod.mockChecklistService;
};

describe("mockChecklistService", () => {
  let svc: Awaited<ReturnType<typeof loadService>>;

  beforeEach(async () => {
    // vitest isolates modules per file; we just grab the service
    svc = await loadService();
  });

  describe("templates", () => {
    it("lists seeded templates", async () => {
      const all = await svc.listTemplates();
      expect(all.length).toBeGreaterThanOrEqual(2);
      expect(all.some((t) => t.type === "opening")).toBe(true);
      expect(all.some((t) => t.type === "closing")).toBe(true);
    });

    it("filters by type", async () => {
      const opening = await svc.listTemplates("opening");
      expect(opening.every((t) => t.type === "opening")).toBe(true);
    });

    it("creates a template", async () => {
      const created = await svc.createTemplate({
        name: "Custom Check",
        type: "opening",
        active: true,
        items: [{ id: "x1", label: "Test item", required: true }],
      });
      expect(created.id).toBeTruthy();
      expect(created.venueId).toBe("venue-1");
      expect(created.items).toHaveLength(1);

      const found = await svc.getTemplate(created.id);
      expect(found?.name).toBe("Custom Check");
    });

    it("updates a template", async () => {
      const all = await svc.listTemplates();
      const updated = await svc.updateTemplate(all[0].id, { name: "Renamed" });
      expect(updated?.name).toBe("Renamed");
    });

    it("deletes a template", async () => {
      const before = await svc.listTemplates();
      await svc.deleteTemplate(before[0].id);
      const after = await svc.listTemplates();
      expect(after.length).toBe(before.length - 1);
    });
  });

  describe("runs", () => {
    it("starts a run from a template", async () => {
      const templates = await svc.listTemplates("opening");
      const run = await svc.startRun({
        templateId: templates[0].id,
        businessDate: "2026-07-29",
        staffId: "st-amara",
        staffName: "Amara Bélanger",
      });
      expect(run).not.toBeNull();
      expect(run!.status).toBe("in-progress");
      expect(run!.items.length).toBe(templates[0].items.length);
      expect(run!.items.every((i) => !i.checked)).toBe(true);
    });

    it("returns null for unknown template", async () => {
      const run = await svc.startRun({
        templateId: "nonexistent",
        businessDate: "2026-07-29",
        staffId: "st-amara",
        staffName: "Amara Bélanger",
      });
      expect(run).toBeNull();
    });

    it("checks an item", async () => {
      const templates = await svc.listTemplates("opening");
      const run = await svc.startRun({
        templateId: templates[0].id,
        businessDate: "2026-07-29",
        staffId: "st-amara",
        staffName: "Amara Bélanger",
      });
      const itemId = run!.items[0].templateItemId;
      const updated = await svc.checkItem(run!.id, itemId, true, "st-amara", "All clear");
      expect(updated!.items[0].checked).toBe(true);
      expect(updated!.items[0].note).toBe("All clear");
      expect(updated!.items[0].checkedByStaffId).toBe("st-amara");
    });

    it("unchecks an item", async () => {
      const templates = await svc.listTemplates("opening");
      const run = await svc.startRun({
        templateId: templates[0].id,
        businessDate: "2026-07-29",
        staffId: "st-amara",
        staffName: "Amara Bélanger",
      });
      const itemId = run!.items[0].templateItemId;
      await svc.checkItem(run!.id, itemId, true, "st-amara");
      const unchecked = await svc.checkItem(run!.id, itemId, false, "st-amara");
      expect(unchecked!.items[0].checked).toBe(false);
      expect(unchecked!.items[0].checkedAt).toBeUndefined();
    });

    it("blocks completion when required items are unchecked", async () => {
      const templates = await svc.listTemplates("opening");
      const run = await svc.startRun({
        templateId: templates[0].id,
        businessDate: "2026-07-29",
        staffId: "st-amara",
        staffName: "Amara Bélanger",
      });
      const result = await svc.completeRun(run!.id, "st-amara", "Amara Bélanger");
      expect(result.ok).toBe(false);
      expect(result.missingItems!.length).toBeGreaterThan(0);
    });

    it("completes when all required items are checked", async () => {
      const templates = await svc.listTemplates("opening");
      const template = templates[0];
      const run = await svc.startRun({
        templateId: template.id,
        businessDate: "2026-07-29",
        staffId: "st-amara",
        staffName: "Amara Bélanger",
      });

      // Check all required items
      const requiredIds = new Set(
        template.items.filter((i) => i.required).map((i) => i.id),
      );
      for (const item of run!.items) {
        if (requiredIds.has(item.templateItemId)) {
          await svc.checkItem(run!.id, item.templateItemId, true, "st-amara");
        }
      }

      const result = await svc.completeRun(run!.id, "st-amara", "Amara Bélanger");
      expect(result.ok).toBe(true);

      const completed = await svc.getRun(run!.id);
      expect(completed!.status).toBe("completed");
      expect(completed!.completedByStaffName).toBe("Amara Bélanger");
    }, 15_000);

    it("skips a run", async () => {
      const templates = await svc.listTemplates("closing");
      const run = await svc.startRun({
        templateId: templates[0].id,
        businessDate: "2026-07-29",
        staffId: "st-amara",
        staffName: "Amara Bélanger",
      });
      const skipped = await svc.skipRun(run!.id);
      expect(skipped!.status).toBe("skipped");
    });

    it("cannot check items on a completed run", async () => {
      const templates = await svc.listTemplates("opening");
      const template = templates[0];
      const run = await svc.startRun({
        templateId: template.id,
        businessDate: "2026-07-29",
        staffId: "st-amara",
        staffName: "Amara Bélanger",
      });

      // Complete it first
      const requiredIds = new Set(
        template.items.filter((i) => i.required).map((i) => i.id),
      );
      for (const item of run!.items) {
        if (requiredIds.has(item.templateItemId)) {
          await svc.checkItem(run!.id, item.templateItemId, true, "st-amara");
        }
      }
      await svc.completeRun(run!.id, "st-amara", "Amara Bélanger");

      // Now try to check an item — should return null
      const result = await svc.checkItem(
        run!.id, run!.items[0].templateItemId, true, "st-amara",
      );
      expect(result).toBeNull();
    }, 15_000);

    it("filters runs by business date", async () => {
      const templates = await svc.listTemplates("opening");
      await svc.startRun({
        templateId: templates[0].id,
        businessDate: "2026-07-29",
        staffId: "st-amara",
        staffName: "Amara Bélanger",
      });
      await svc.startRun({
        templateId: templates[0].id,
        businessDate: "2026-07-30",
        staffId: "st-amara",
        staffName: "Amara Bélanger",
      });

      const tonight = await svc.listRuns({ businessDate: "2026-07-29" });
      expect(tonight.every((r) => r.businessDate === "2026-07-29")).toBe(true);
    });
  });
});
