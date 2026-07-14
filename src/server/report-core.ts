/**
 * Report engine: CRUD for saved reports, run recording, CSV rendering,
 * and scheduled-report due selection.
 */
import { Prisma } from "@prisma/client";
import type { getDb } from "./db";
import type { HistoricalAnalytics } from "@/lib/mock-services/analytics-service";
import type { ReportMetric, SavedReport, ReportSchedule } from "@/lib/mock-services/report-service";

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

function escapeCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export function renderCsv(
  reportName: string,
  metrics: ReportMetric[],
  data: HistoricalAnalytics,
): string {
  const rows: string[][] = [
    ["Report", reportName],
    ["Range", `${data.from} → ${data.to} (${data.days} nights)`],
    [],
  ];

  if (metrics.includes("revenue")) {
    rows.push(["Night", "Revenue", "Orders"]);
    for (const p of data.series) rows.push([p.label, String(p.revenue), String(p.orders)]);
    rows.push(["Total", String(data.totalRevenue), String(data.totalOrders)], []);
  }
  if (metrics.includes("zones")) {
    rows.push(["Zone", "Revenue"]);
    for (const z of data.revenueByZone) rows.push([z.zoneName, String(z.revenue)]);
    rows.push([]);
  }
  if (metrics.includes("top-items")) {
    rows.push(["Item", "Sold", "Revenue"]);
    for (const t of data.topItems) rows.push([t.name, String(t.count), String(t.revenue)]);
    rows.push([]);
  }
  if (metrics.includes("staff")) {
    rows.push(["Staff", "Role", "Orders delivered", "Avg minutes", "Revenue served"]);
    for (const s of data.staffPerformance)
      rows.push([s.name, s.role, String(s.ordersDelivered), String(s.avgDeliveryMinutes), String(s.revenueServed)]);
    rows.push([]);
  }
  if (metrics.includes("inventory")) {
    rows.push(["Category", "Units sold", "In stock"]);
    for (const c of data.categoryDepletion)
      rows.push([c.categoryName, String(c.unitsSold), String(c.unitsInStock)]);
  }

  return rows.map((r) => r.map(escapeCell).join(",")).join("\n");
}

// ── Scheduled report selection ───────────────────────────────────────

/**
 * Returns reports whose schedule is due based on the given date.
 * daily = every day, weekly = Mondays, monthly = 1st of month.
 */
export async function findDueReports(
  db: ScopedDb,
  today: Date,
): Promise<SavedReport[]> {
  const dayOfWeek = today.getDay(); // 0=Sun..6=Sat
  const dayOfMonth = today.getDate();

  const all = await db.savedReport.findMany({
    where: { schedule: { not: Prisma.DbNull } },
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
          return dayOfWeek === 1; // Monday
        case "monthly":
          return dayOfMonth === 1;
        default:
          return false;
      }
    });
}
