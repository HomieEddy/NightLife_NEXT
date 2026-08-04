/**
 * Report engine: CRUD for saved reports, run recording, CSV rendering,
 * and scheduled-report due selection.
 */
import type { getDb } from "@/features/shared/db";
import type { ReportMetric, SavedReport, ReportSchedule } from "@/lib/types";

type ScopedDb = ReturnType<typeof getDb>;

// ── Row → domain mapper ─────────────────────────────────────────────

interface ReportRow {
  id: string;
  venueId: string;
  name: string;
  metrics: unknown;
  rangeDays: number;
  schedule: unknown;
  createdAt: Date;
  updatedAt: Date;
  runs?: { ranAt: Date }[];
}

function toSavedReport(row: ReportRow): SavedReport {
  const lastRun = row.runs?.[0]?.ranAt;
  return {
    id: row.id,
    name: row.name,
    metrics: row.metrics as ReportMetric[],
    rangeDays: row.rangeDays,
    schedule: (row.schedule as ReportSchedule) ?? null,
    createdAt: row.createdAt.toISOString(),
    lastRunAt: lastRun?.toISOString() ?? null,
  };
}

// ── CRUD ─────────────────────────────────────────────────────────────

export async function listReports(db: ScopedDb): Promise<SavedReport[]> {
  const rows = await db.savedReport.findMany({
    include: { runs: { orderBy: { ranAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toSavedReport);
}

export async function createReport(
  db: ScopedDb,
  venueId: string,
  input: { name: string; metrics: ReportMetric[]; rangeDays: number; schedule: ReportSchedule | null },
): Promise<SavedReport> {
  const row = await db.savedReport.create({
    data: {
      venueId,
      name: input.name,
      metrics: input.metrics as unknown as object,
      rangeDays: input.rangeDays,
      schedule: input.schedule as unknown as object ?? undefined,
    },
    include: { runs: { orderBy: { ranAt: "desc" }, take: 1 } },
  });
  return toSavedReport(row);
}

export async function updateReport(
  db: ScopedDb,
  reportId: string,
  patch: Partial<{ name: string; metrics: ReportMetric[]; rangeDays: number; schedule: ReportSchedule | null }>,
): Promise<SavedReport | null> {
  const existing = await db.savedReport.findUnique({ where: { id: reportId } });
  if (!existing) return null;

  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.metrics !== undefined) data.metrics = patch.metrics;
  if (patch.rangeDays !== undefined) data.rangeDays = patch.rangeDays;
  if (patch.schedule !== undefined) data.schedule = patch.schedule as unknown as object ?? undefined;

  const row = await db.savedReport.update({
    where: { id: reportId },
    data,
    include: { runs: { orderBy: { ranAt: "desc" }, take: 1 } },
  });
  return toSavedReport(row);
}

export async function deleteReport(db: ScopedDb, reportId: string): Promise<void> {
  await db.savedReport.delete({ where: { id: reportId } });
}

// ── Run recording ────────────────────────────────────────────────────

export async function recordRun(
  db: ScopedDb,
  reportId: string,
  fromDate: string,
  toDate: string,
  trigger: "manual" | "scheduled" = "manual",
): Promise<void> {
  await db.reportRun.create({
    data: { reportId, fromDate, toDate, trigger },
  });
}

// ── CSV rendering ────────────────────────────────────────────────────

// Pure and client-safe — implementation lives in src/lib/report-csv.ts.
export { renderCsv } from "@/features/analytics/report-csv";


// ── Scheduled report selection ───────────────────────────────────────

/**
 * Returns reports whose schedule is due based on the given date.
 * daily = every day, weekly = Mondays, monthly = 1st of month.
 * The weekday/month-day resolve in the venue's timezone (a venue across a
 * date line must not fire weekly/monthly reports on the wrong day).
 */
export async function findDueReports(
  db: ScopedDb,
  today: Date,
  timezone = "UTC",
): Promise<SavedReport[]> {
  const weekday = today.toLocaleString("en-US", { timeZone: timezone, weekday: "long" });
  const dayOfMonth = Number(today.toLocaleString("en-US", { timeZone: timezone, day: "2-digit" }));

  const all = await db.savedReport.findMany({
    include: { runs: { orderBy: { ranAt: "desc" }, take: 1 } },
  });

  return all
    .map(toSavedReport)
    .filter((r) => {
      if (!r.schedule) return false;
      switch (r.schedule.frequency) {
        case "daily":
          return true;
        case "weekly":
          return weekday === "Monday";
        case "monthly":
          return dayOfMonth === 1;
        default:
          return false;
      }
    });
}
