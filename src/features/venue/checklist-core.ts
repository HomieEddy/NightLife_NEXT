import type { getDb } from "@/features/shared/db";
import type {
  ChecklistTemplate,
  ChecklistTemplateItem,
  ChecklistRun,
  ChecklistRunItem,
  ChecklistType,
} from "@/lib/types";

type ScopedDb = ReturnType<typeof getDb>;

function toISO(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return String(v ?? "");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

// ── Template DTO helpers ───────────────────────────────────────────

function templateRowToDTO(r: Row): ChecklistTemplate {
  const items = (r.items as unknown as ChecklistTemplateItem[] | undefined) ?? [];
  return {
    id: r.id,
    venueId: r.venue_id ?? r.venueId,
    name: r.name,
    type: r.type as ChecklistType,
    active: r.active,
    items,
  };
}

// ── Run DTO helpers ────────────────────────────────────────────────

function runRowToDTO(r: Row): ChecklistRun {
  const items = (r.items as unknown as ChecklistRunItem[] | undefined) ?? [];
  return {
    id: r.id,
    venueId: r.venue_id ?? r.venueId,
    templateId: r.template_id ?? r.templateId,
    templateName: r.template_name ?? r.templateName,
    type: r.type as ChecklistType,
    businessDate: r.business_date ?? r.businessDate,
    status: r.status as ChecklistRun["status"],
    items,
    startedAt: toISO(r.started_at ?? r.startedAt),
    startedByStaffId: r.started_by_staff_id ?? r.startedByStaffId,
    startedByStaffName: r.started_by_staff_name ?? r.startedByStaffName,
    completedAt: r.completed_at ? toISO(r.completed_at) : undefined,
    completedByStaffId: r.completed_by_staff_id ?? r.completedByStaffId ?? undefined,
    completedByStaffName: r.completed_by_staff_name ?? r.completedByStaffName ?? undefined,
  };
}

function assertRow<T>(row: T): asserts row is NonNullable<T> {
  if (!row) throw new Error("Record not found.");
}

// ── Templates ──────────────────────────────────────────────────────

export async function listTemplates(
  db: ScopedDb,
  type?: ChecklistType,
): Promise<ChecklistTemplate[]> {
  const where = type ? { type } : {};
  const rows = await db.checklistTemplate.findMany({ where, orderBy: { name: "asc" } });
  return rows.map(templateRowToDTO);
}

export async function getTemplate(db: ScopedDb, id: string): Promise<ChecklistTemplate | null> {
  const row = await db.checklistTemplate.findUnique({ where: { id } });
  return row ? templateRowToDTO(row) : null;
}

export async function createTemplate(
  db: ScopedDb,
  input: Omit<ChecklistTemplate, "id" | "venueId">,
): Promise<ChecklistTemplate> {
  const row = await db.checklistTemplate.create({
    data: {
      name: input.name,
      type: input.type,
      active: input.active,
      items: input.items as Row,
    },
  } as Row) as Row;
  return templateRowToDTO(row);
}

export async function updateTemplate(
  db: ScopedDb,
  id: string,
  patch: Partial<Omit<ChecklistTemplate, "id" | "venueId">>,
): Promise<ChecklistTemplate | null> {
  const exists = await db.checklistTemplate.findUnique({ where: { id } });
  if (!exists) return null;
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.type !== undefined) data.type = patch.type;
  if (patch.active !== undefined) data.active = patch.active;
  if (patch.items !== undefined) data.items = patch.items;
  const row = await db.checklistTemplate.update({ where: { id }, data }) as Row;
  return templateRowToDTO(row);
}

export async function deleteTemplate(db: ScopedDb, id: string): Promise<void> {
  await db.checklistTemplate.delete({ where: { id } });
}

// ── Runs ───────────────────────────────────────────────────────────

export async function listRuns(
  db: ScopedDb,
  filter?: { type?: ChecklistType; businessDate?: string },
): Promise<ChecklistRun[]> {
  const where: Record<string, unknown> = {};
  if (filter?.type) where.type = filter.type;
  if (filter?.businessDate) where.businessDate = filter.businessDate;
  const rows = await db.checklistRun.findMany({
    where,
    orderBy: { startedAt: "desc" },
  });
  return rows.map(runRowToDTO);
}

export async function getRun(db: ScopedDb, id: string): Promise<ChecklistRun | null> {
  const row = await db.checklistRun.findUnique({ where: { id } });
  return row ? runRowToDTO(row) : null;
}

export async function startRun(
  db: ScopedDb,
  input: {
    templateId: string;
    businessDate: string;
    staffId: string;
    staffName: string;
  },
): Promise<ChecklistRun | null> {
  const template = await db.checklistTemplate.findUnique({ where: { id: input.templateId } });
  if (!template) return null;

  const templateItems = (template.items as unknown as ChecklistTemplateItem[]) ?? [];
  const items: ChecklistRunItem[] = templateItems.map((ti) => ({
    templateItemId: ti.id,
    label: ti.label,
    checked: false,
  }));

  const row = await db.checklistRun.create({
    data: {
      templateId: template.id,
      templateName: template.name,
      type: template.type,
      businessDate: input.businessDate,
      status: "in-progress",
      items: items as Row,
      startedAt: new Date(),
      startedByStaffId: input.staffId,
      startedByStaffName: input.staffName,
    },
  } as Row) as Row;
  return runRowToDTO(row);
}

export async function checkItem(
  db: ScopedDb,
  runId: string,
  templateItemId: string,
  checked: boolean,
  staffId: string,
  note?: string,
): Promise<ChecklistRun | null> {
  const run = await db.checklistRun.findUnique({ where: { id: runId } });
  if (!run || run.status !== "in-progress") return null;

  const items = (run.items as unknown as ChecklistRunItem[]) ?? [];
  const idx = items.findIndex((i) => i.templateItemId === templateItemId);
  if (idx === -1) return null;

  items[idx] = {
    ...items[idx],
    checked,
    checkedAt: checked ? new Date().toISOString() : undefined,
    checkedByStaffId: checked ? staffId : undefined,
    ...(note !== undefined ? { note } : {}),
  };

  await db.checklistRun.update({
    where: { id: runId },
    data: { items: items as Row },
  });

  const updated = await db.checklistRun.findUnique({ where: { id: runId } });
  assertRow(updated);
  return runRowToDTO(updated);
}

export async function completeRun(
  db: ScopedDb,
  runId: string,
  staffId: string,
  staffName: string,
): Promise<{ ok: boolean; missingItems?: string[] }> {
  const run = await db.checklistRun.findUnique({ where: { id: runId } });
  if (!run || run.status !== "in-progress") return { ok: false };

  const template = await db.checklistTemplate.findUnique({ where: { id: run.templateId } });
  const requiredItemIds = new Set(
    ((template?.items as unknown as ChecklistTemplateItem[]) ?? [])
      .filter((i) => i.required)
      .map((i) => i.id),
  );
  const runItems = (run.items as unknown as ChecklistRunItem[]) ?? [];
  const missing = runItems
    .filter((i) => requiredItemIds.has(i.templateItemId) && !i.checked)
    .map((i) => i.label);

  if (missing.length > 0) return { ok: false, missingItems: missing };

  await db.checklistRun.update({
    where: { id: runId },
    data: {
      status: "completed",
      completedAt: new Date(),
      completedByStaffId: staffId,
      completedByStaffName: staffName,
    },
  });

  return { ok: true };
}

export async function skipRun(db: ScopedDb, runId: string): Promise<ChecklistRun | null> {
  const run = await db.checklistRun.findUnique({ where: { id: runId } });
  if (!run || run.status !== "in-progress") return null;

  await db.checklistRun.update({ where: { id: runId }, data: { status: "skipped" } });
  const updated = await db.checklistRun.findUnique({ where: { id: runId } });
  assertRow(updated);
  return runRowToDTO(updated);
}
