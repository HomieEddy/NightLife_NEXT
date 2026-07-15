/**
 * Report engine: CRUD for saved reports, run recording, CSV rendering,
 * and scheduled-report due selection.
 */
import type { getDb } from "./db";
import type { HistoricalAnalytics, ReportMetric, SavedReport, ReportSchedule } from "@/lib/types";

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
    rows.push(["Staff", "Role", "Orders delivered", "Avg minutes", "Revenue served", "Claim wait min", "Help resolved", "Avg help min", "Orders/hr"]);
    for (const s of data.staffPerformance)
      rows.push([s.name, s.role, String(s.ordersDelivered), String(s.avgDeliveryMinutes), String(s.revenueServed), String(s.avgClaimMinutes ?? ""), String(s.helpResolved ?? ""), String(s.avgHelpMinutes ?? ""), String(s.ordersPerShiftHour ?? "")]);
    rows.push([]);
  }
  if (metrics.includes("inventory")) {
    rows.push(["Category", "Units sold", "In stock", "Sell-through", "Sold-out min", "Restock units"]);
    for (const c of data.categoryDepletion)
      rows.push([c.categoryName, String(c.unitsSold), String(c.unitsInStock), String(c.sellThrough ?? ""), String(c.soldOutMinutes ?? ""), String(c.restockUnits ?? "")]);
    rows.push([]);
  }
  if (metrics.includes("sessions") && data.sessions) {
    const s = data.sessions;
    rows.push(["Sessions"]);
    rows.push(["Total sessions", String(s.totalSessions)]);
    rows.push(["Approval rate", String(s.approvalRate)]);
    rows.push(["Denial rate", String(s.denialRate)]);
    rows.push(["Avg approval min", String(s.avgApprovalMinutes)]);
    rows.push(["Avg duration min", String(s.avgDurationMinutes)]);
    rows.push(["Avg party size", String(s.avgPartySize)]);
    rows.push(["Revenue / session", String(s.revenuePerSession)]);
    rows.push(["Revenue / guest", String(s.revenuePerGuest)]);
    rows.push(["Avg closure min", String(s.avgClosureMinutes)]);
    rows.push(["Settlement method", "Count", "Pct"]);
    for (const m of s.settlementMix) rows.push([m.method, String(m.count), String(m.pct)]);
    rows.push([]);
  }
  if (metrics.includes("reservations") && data.reservations) {
    const r = data.reservations;
    rows.push(["Reservations"]);
    rows.push(["Requested", "Confirmed", "Seated", "Completed", "Cancelled", "No-show rate", "Avg lead days", "Total covers"]);
    rows.push([String(r.requested), String(r.confirmed), String(r.seated), String(r.completed), String(r.cancelled), String(r.noShowRate), String(r.avgLeadDays), String(r.totalCovers)]);
    rows.push(["Source", "Count", "Pct"]);
    for (const s of r.sourceSplit) rows.push([s.source, String(s.count), String(s.pct)]);
    rows.push([]);
  }
  if (metrics.includes("happy-hours") && data.happyHours) {
    const h = data.happyHours;
    rows.push(["Happy Hours"]);
    rows.push(["Total HH orders", String(h.totalHhOrders)]);
    rows.push(["Total HH revenue", String(h.totalHhRevenue)]);
    rows.push(["Total discount given", String(h.totalDiscountGiven)]);
    rows.push(["Rule", "Orders", "Revenue", "Discount", "Category uplift"]);
    for (const r of h.rules) rows.push([r.ruleName, String(r.orders), String(r.revenue), String(r.discountGiven), String(r.categoryUpliftPct)]);
    rows.push([]);
  }
  if (metrics.includes("events") && data.events) {
    rows.push(["Events"]);
    rows.push(["Event", "Invited", "Confirmed", "Checked in", "Utilization", "Event revenue", "Avg weekday revenue"]);
    for (const e of data.events.events)
      rows.push([e.eventName, String(e.invited), String(e.confirmed), String(e.checkedIn), String(e.capacityUtilization), String(e.eventRevenue), String(e.avgWeekdayRevenue)]);
    rows.push([]);
  }
  if (metrics.includes("promotions") && data.promotions) {
    rows.push(["Promotions"]);
    rows.push(["Code", "Redemptions", "Discount cost", "Attributed revenue", "AOV with promo", "AOV without promo"]);
    for (const p of data.promotions.promotions)
      rows.push([p.code, String(p.redemptions), String(p.discountCost), String(p.attributedRevenue), String(p.aovWithPromo), String(p.aovWithoutPromo)]);
    rows.push([]);
  }
  if (metrics.includes("order-funnel") && data.orderFunnel) {
    const f = data.orderFunnel;
    rows.push(["Order Funnel"]);
    rows.push(["Placed", "Accepted", "Delivered", "Cancelled", "Cancellation rate", "Tip rate", "Avg tip", "Service fee revenue", "Gift orders", "Gift revenue", "Modifier attach rate"]);
    rows.push([String(f.placed), String(f.accepted), String(f.delivered), String(f.cancelled), String(f.cancellationRate), String(f.tipRate), String(f.avgTip), String(f.serviceFeeRevenue), String(f.giftOrders), String(f.giftRevenue), String(f.modifierAttachRate)]);
    rows.push([]);
  }
  if (metrics.includes("service-fees") && data.orderFunnel) {
    rows.push(["Service Fees"]);
    rows.push(["Service fee revenue", String(data.orderFunnel.serviceFeeRevenue)]);
    rows.push([]);
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
