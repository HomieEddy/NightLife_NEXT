/**
 * mockChecklistService — opening/closing checklist management (VM-05).
 * Templates define what needs to be checked; runs track a specific night's
 * execution. Required items must be checked before a run can complete.
 *
 * TODO(backend): templates are venue-scoped rows; runs are append-only per
 * business date. Completing a run writes an AuditEntry.
 */
import type {
  ChecklistRun,
  ChecklistRunItem,
  ChecklistTemplate,
  ChecklistType,
} from "@/lib/types";
import { mockChecklistTemplates } from "@/features/venue/checklist-mock-data";
import { mockVenue } from "@/features/venue/mock-data";
import { clone, delay, uid } from "@/features/shared/delay";

let templates: ChecklistTemplate[] = clone(mockChecklistTemplates);
let runs: ChecklistRun[] = [];

export const mockChecklistService = {
  // ── Templates ──────────────────────────────────────────────

  async listTemplates(type?: ChecklistType): Promise<ChecklistTemplate[]> {
    await delay();
    const result = type ? templates.filter((t) => t.type === type) : templates;
    return clone(result);
  },

  async getTemplate(id: string): Promise<ChecklistTemplate | null> {
    await delay(200);
    return clone(templates.find((t) => t.id === id) ?? null);
  },

  async createTemplate(
    input: Omit<ChecklistTemplate, "id" | "venueId">,
  ): Promise<ChecklistTemplate> {
    await delay(400);
    const template: ChecklistTemplate = {
      id: uid("clt"),
      venueId: mockVenue.id,
      ...input,
    };
    templates = [...templates, template];
    return clone(template);
  },

  async updateTemplate(
    id: string,
    patch: Partial<Omit<ChecklistTemplate, "id" | "venueId">>,
  ): Promise<ChecklistTemplate | null> {
    await delay(400);
    const template = templates.find((t) => t.id === id);
    if (!template) return null;
    Object.assign(template, patch);
    return clone(template);
  },

  async deleteTemplate(id: string): Promise<void> {
    await delay(300);
    templates = templates.filter((t) => t.id !== id);
  },

  // ── Runs ───────────────────────────────────────────────────

  async listRuns(filter?: {
    type?: ChecklistType;
    businessDate?: string;
  }): Promise<ChecklistRun[]> {
    await delay();
    let result = runs;
    if (filter?.type) result = result.filter((r) => r.type === filter.type);
    if (filter?.businessDate)
      result = result.filter((r) => r.businessDate === filter.businessDate);
    return clone(result).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  },

  async getRun(id: string): Promise<ChecklistRun | null> {
    await delay(200);
    return clone(runs.find((r) => r.id === id) ?? null);
  },

  /** Start a new run from a template for tonight's business date. */
  async startRun(input: {
    templateId: string;
    businessDate: string;
    staffId: string;
    staffName: string;
  }): Promise<ChecklistRun | null> {
    await delay(400);
    const template = templates.find((t) => t.id === input.templateId);
    if (!template) return null;

    const items: ChecklistRunItem[] = template.items.map((ti) => ({
      templateItemId: ti.id,
      label: ti.label,
      checked: false,
    }));

    const run: ChecklistRun = {
      id: uid("clr"),
      venueId: mockVenue.id,
      templateId: template.id,
      templateName: template.name,
      type: template.type,
      businessDate: input.businessDate,
      status: "in-progress",
      items,
      startedAt: new Date().toISOString(),
      startedByStaffId: input.staffId,
      startedByStaffName: input.staffName,
    };
    runs = [run, ...runs];
    return clone(run);
  },

  /** Toggle a single item in an in-progress run. */
  async checkItem(
    runId: string,
    templateItemId: string,
    checked: boolean,
    staffId: string,
    note?: string,
  ): Promise<ChecklistRun | null> {
    await delay(200);
    const run = runs.find((r) => r.id === runId);
    if (!run || run.status !== "in-progress") return null;

    const item = run.items.find((i) => i.templateItemId === templateItemId);
    if (!item) return null;

    item.checked = checked;
    item.checkedAt = checked ? new Date().toISOString() : undefined;
    item.checkedByStaffId = checked ? staffId : undefined;
    if (note !== undefined) item.note = note;

    return clone(run);
  },

  /**
   * Complete a run — fails if any required items are unchecked.
   * Returns { ok, missingItems } so the UI can show what's left.
   */
  async completeRun(
    runId: string,
    staffId: string,
    staffName: string,
  ): Promise<{ ok: boolean; missingItems?: string[] }> {
    await delay(300);
    const run = runs.find((r) => r.id === runId);
    if (!run || run.status !== "in-progress") return { ok: false };

    const template = templates.find((t) => t.id === run.templateId);
    const requiredItemIds = new Set(
      (template?.items ?? []).filter((i) => i.required).map((i) => i.id),
    );
    const missing = run.items
      .filter((i) => requiredItemIds.has(i.templateItemId) && !i.checked)
      .map((i) => i.label);

    if (missing.length > 0) return { ok: false, missingItems: missing };

    run.status = "completed";
    run.completedAt = new Date().toISOString();
    run.completedByStaffId = staffId;
    run.completedByStaffName = staffName;
    return { ok: true };
  },

  /** Skip a run entirely (e.g. emergency, items handled out of band). */
  async skipRun(runId: string): Promise<ChecklistRun | null> {
    await delay(200);
    const run = runs.find((r) => r.id === runId);
    if (!run || run.status !== "in-progress") return null;
    run.status = "skipped";
    return clone(run);
  },
};
