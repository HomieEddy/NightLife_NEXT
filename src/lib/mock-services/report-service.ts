/**
 * mockReportService — demo-mode report CRUD with in-memory store.
 */
import { clone, delay, uid } from "./delay";

export const REPORT_METRICS = [
  { id: "revenue", label: "Revenue & orders" },
  { id: "zones", label: "Revenue by zone" },
  { id: "top-items", label: "Top items" },
  { id: "staff", label: "Staff performance" },
  { id: "inventory", label: "Inventory depletion" },
] as const;

export type ReportMetric = (typeof REPORT_METRICS)[number]["id"];

export interface ReportSchedule {
  frequency: "daily" | "weekly" | "monthly";
  recipient: string; // email
}

export interface SavedReport {
  id: string;
  name: string;
  metrics: ReportMetric[];
  /** Rolling window in days — the engine re-resolves dates at run time. */
  rangeDays: number;
  schedule: ReportSchedule | null;
  createdAt: string;
  lastRunAt: string | null;
}

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

let reports: SavedReport[] = [
  {
    id: "rpt-weekly",
    name: "Weekly performance",
    metrics: ["revenue", "zones", "top-items"],
    rangeDays: 7,
    schedule: { frequency: "weekly", recipient: "amara@luxenoir.club" },
    createdAt: daysAgo(30),
    lastRunAt: daysAgo(2),
  },
  {
    id: "rpt-staff-month",
    name: "Monthly staff review",
    metrics: ["staff"],
    rangeDays: 30,
    schedule: null,
    createdAt: daysAgo(12),
    lastRunAt: null,
  },
];

export const mockReportService = {
  async listReports(): Promise<SavedReport[]> {
    await delay(300);
    return clone(reports).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async createReport(
    input: Omit<SavedReport, "id" | "createdAt" | "lastRunAt">,
  ): Promise<SavedReport> {
    await delay(500);
    const report: SavedReport = {
      id: uid("rpt"),
      createdAt: new Date().toISOString(),
      lastRunAt: null,
      ...input,
    };
    reports = [report, ...reports];
    return clone(report);
  },

  async updateReport(
    reportId: string,
    patch: Partial<Omit<SavedReport, "id" | "createdAt">>,
  ): Promise<SavedReport | null> {
    await delay(400);
    const report = reports.find((r) => r.id === reportId);
    if (!report) return null;
    Object.assign(report, patch);
    return clone(report);
  },

  async deleteReport(reportId: string): Promise<void> {
    await delay(300);
    reports = reports.filter((r) => r.id !== reportId);
  },

  /** Stamp a run — the page pairs this with getHistorical for the actual data. */
  async markRun(reportId: string): Promise<void> {
    const report = reports.find((r) => r.id === reportId);
    if (report) report.lastRunAt = new Date().toISOString();
  },
};
