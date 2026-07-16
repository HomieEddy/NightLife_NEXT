"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock, Download, Eye, FileText, Loader2, Pencil, Plus, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { MetricCard } from "@/components/shared/metric-card";
import { MockChart } from "@/components/shared/mock-chart";
import { PageHeader } from "@/components/shared/page-header";
import { RoleBadge } from "@/components/shared/role-badge";
import {
  aggregateWeekly, analyticsService, type HistoricalAnalytics,
} from "@/lib/services/analytics-service";
import {
  reportService, REPORT_METRICS, type ReportMetric, type SavedReport,
} from "@/lib/services/report-service";
import { formatMoney, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const RANGE_OPTIONS = [
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 90 days" },
];

const isoDaysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

interface Draft {
  name: string;
  metrics: ReportMetric[];
  rangeDays: number;
  scheduled: boolean;
  frequency: "daily" | "weekly" | "monthly";
  recipient: string;
}

const EMPTY_DRAFT: Draft = {
  name: "",
  metrics: ["revenue"],
  rangeDays: 7,
  scheduled: false,
  frequency: "weekly",
  recipient: "amara@luxenoir.club",
};

function metricLabel(id: ReportMetric): string {
  return REPORT_METRICS.find((m) => m.id === id)?.label ?? id;
}

/** Client-side CSV export — the backend report engine will render real files. */
function downloadCsv(report: SavedReport, data: HistoricalAnalytics) {
  const rows: string[][] = [
    ["Report", report.name],
    ["Range", `${data.from} → ${data.to} (${data.days} nights)`],
    [],
  ];
  if (report.metrics.includes("revenue")) {
    rows.push(["Night", "Revenue", "Orders"]);
    for (const p of data.series) rows.push([p.label, String(p.revenue), String(p.orders)]);
    rows.push(["Total", String(data.totalRevenue), String(data.totalOrders)], []);
  }
  if (report.metrics.includes("zones")) {
    rows.push(["Zone", "Revenue"]);
    for (const z of data.revenueByZone) rows.push([z.zoneName, String(z.revenue)]);
    rows.push([]);
  }
  if (report.metrics.includes("top-items")) {
    rows.push(["Item", "Sold", "Revenue"]);
    for (const t of data.topItems) rows.push([t.name, String(t.count), String(t.revenue)]);
    rows.push([]);
  }
  if (report.metrics.includes("staff")) {
    rows.push(["Staff", "Role", "Orders delivered", "Avg minutes", "Revenue served", "Claim wait min", "Help resolved", "Avg help min", "Orders/hr"]);
    for (const s of data.staffPerformance)
      rows.push([s.name, s.role, String(s.ordersDelivered), String(s.avgDeliveryMinutes), String(s.revenueServed), String(s.avgClaimMinutes ?? ""), String(s.helpResolved ?? ""), String(s.avgHelpMinutes ?? ""), String(s.ordersPerShiftHour ?? "")]);
    rows.push([]);
  }
  if (report.metrics.includes("inventory")) {
    rows.push(["Category", "Units sold", "In stock", "Sell-through", "Sold-out min", "Restock units"]);
    for (const c of data.categoryDepletion)
      rows.push([c.categoryName, String(c.unitsSold), String(c.unitsInStock), String(c.sellThrough ?? ""), String(c.soldOutMinutes ?? ""), String(c.restockUnits ?? "")]);
    rows.push([]);
  }
  if (report.metrics.includes("sessions") && data.sessions) {
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
    rows.push(["Tab settlement (staff-recorded)", "Count", "Pct"]);
    for (const m of s.settlementMix) rows.push([m.method, String(m.count), String(m.pct)]);
    rows.push([]);
  }
  if (report.metrics.includes("reservations") && data.reservations) {
    const r = data.reservations;
    rows.push(["Reservations"]);
    rows.push(["Requested", "Confirmed", "Seated", "Completed", "Cancelled", "No-show rate", "Avg lead days", "Total covers"]);
    rows.push([String(r.requested), String(r.confirmed), String(r.seated), String(r.completed), String(r.cancelled), String(r.noShowRate), String(r.avgLeadDays), String(r.totalCovers)]);
    rows.push([]);
  }
  if (report.metrics.includes("happy-hours") && data.happyHours) {
    const h = data.happyHours;
    rows.push(["Happy Hours"]);
    rows.push(["Total HH orders", String(h.totalHhOrders)]);
    rows.push(["Total HH revenue", String(h.totalHhRevenue)]);
    rows.push(["Total discount given", String(h.totalDiscountGiven)]);
    rows.push(["Rule", "Orders", "Revenue", "Discount", "Category uplift"]);
    for (const r of h.rules) rows.push([r.ruleName, String(r.orders), String(r.revenue), String(r.discountGiven), String(r.categoryUpliftPct)]);
    rows.push([]);
  }
  if (report.metrics.includes("events") && data.events) {
    rows.push(["Events"]);
    rows.push(["Event", "Invited", "Confirmed", "Checked in", "Utilization", "Event revenue", "Avg weekday revenue"]);
    for (const e of data.events.events)
      rows.push([e.eventName, String(e.invited), String(e.confirmed), String(e.checkedIn), String(e.capacityUtilization), String(e.eventRevenue), String(e.avgWeekdayRevenue)]);
    rows.push([]);
  }
  if (report.metrics.includes("promotions") && data.promotions) {
    rows.push(["Promotions"]);
    rows.push(["Code", "Redemptions", "Discount cost", "Attributed revenue", "AOV with promo", "AOV without promo"]);
    for (const p of data.promotions.promotions)
      rows.push([p.code, String(p.redemptions), String(p.discountCost), String(p.attributedRevenue), String(p.aovWithPromo), String(p.aovWithoutPromo)]);
    rows.push([]);
  }
  if (report.metrics.includes("order-funnel") && data.orderFunnel) {
    const f = data.orderFunnel;
    rows.push(["Order Funnel"]);
    rows.push(["Placed", "Delivered", "Cancelled", "Cancellation rate", "Tip rate", "Avg tip", "Service fee revenue", "Gift orders", "Gift revenue", "Modifier attach rate"]);
    rows.push([String(f.placed), String(f.delivered), String(f.cancelled), String(f.cancellationRate), String(f.tipRate), String(f.avgTip), String(f.serviceFeeRevenue), String(f.giftOrders), String(f.giftRevenue), String(f.modifierAttachRate)]);
    rows.push([]);
  }
  if (report.metrics.includes("service-fees") && data.orderFunnel) {
    rows.push(["Service Fees"]);
    rows.push(["Service fee revenue", String(data.orderFunnel.serviceFeeRevenue)]);
    rows.push([]);
  }
  const csv = rows.map((r) => r.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `${report.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function ManagerReportsPage() {
  const [reports, setReports] = useState<SavedReport[] | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<{ report: SavedReport; data: HistoricalAnalytics } | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setReports(await reportService.listReports());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function toggleMetric(id: ReportMetric) {
    setDraft((d) => ({
      ...d,
      metrics: d.metrics.includes(id)
        ? d.metrics.filter((m) => m !== id)
        : [...d.metrics, id],
    }));
  }

  function startEdit(report: SavedReport) {
    setEditingId(report.id);
    setDraft({
      name: report.name,
      metrics: report.metrics,
      rangeDays: report.rangeDays,
      scheduled: report.schedule !== null,
      frequency: report.schedule?.frequency ?? "weekly",
      recipient: report.schedule?.recipient ?? EMPTY_DRAFT.recipient,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    if (!draft.name.trim()) {
      toast.error("Give the report a name.");
      return;
    }
    if (draft.metrics.length === 0) {
      toast.error("Pick at least one metric.");
      return;
    }
    if (draft.scheduled && !draft.recipient.trim()) {
      toast.error("Scheduled reports need a recipient email.");
      return;
    }
    setSaving(true);
    const input = {
      name: draft.name.trim(),
      metrics: draft.metrics,
      rangeDays: draft.rangeDays,
      schedule: draft.scheduled
        ? { frequency: draft.frequency, recipient: draft.recipient.trim() }
        : null,
    };
    if (editingId) {
      await reportService.updateReport(editingId, input);
      toast.success(`${input.name} updated`);
    } else {
      await reportService.createReport(input);
      toast.success(
        input.schedule
          ? `${input.name} saved — runs ${input.schedule.frequency}`
          : `${input.name} saved`,
      );
    }
    setSaving(false);
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    await refresh();
  }

  async function run(report: SavedReport): Promise<HistoricalAnalytics> {
    const data = await analyticsService.getHistorical(
      isoDaysAgo(report.rangeDays - 1),
      isoDaysAgo(0),
    );
    await reportService.markRun(report.id);
    await refresh();
    return data;
  }

  async function view(report: SavedReport) {
    setRunningId(report.id);
    const data = await run(report);
    setViewing({ report, data });
    setRunningId(null);
  }

  async function download(report: SavedReport) {
    setRunningId(report.id);
    downloadCsv(report, await run(report));
    setRunningId(null);
    toast.success(`${report.name} downloaded as CSV`);
  }

  async function remove(report: SavedReport) {
    await reportService.deleteReport(report.id);
    if (viewing?.report.id === report.id) setViewing(null);
    if (editingId === report.id) {
      setEditingId(null);
      setDraft(EMPTY_DRAFT);
    }
    toast.info(`${report.name} deleted`);
    await refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Build, save and schedule recurring reports over historical data."
      />

      {/* ---------- Builder ---------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {editingId ? "Edit report" : "New report"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="report-name">Name</Label>
              <Input
                id="report-name"
                placeholder="e.g. Saturday deep-dive"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data range (rolling)</Label>
              <Select
                value={String(draft.rangeDays)}
                onValueChange={(v) => setDraft({ ...draft, rangeDays: Number(v) })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RANGE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.days} value={String(opt.days)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Included metrics</Label>
            <div className="flex flex-wrap gap-1.5">
              {REPORT_METRICS.map((metric) => (
                <button
                  key={metric.id}
                  type="button"
                  onClick={() => toggleMetric(metric.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    draft.metrics.includes(metric.id)
                      ? "border-primary bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {metric.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <CalendarClock className="size-3.5 text-primary" /> Schedule this report
                </p>
                <p className="text-xs text-muted-foreground">
                  The report engine runs it automatically and emails the result.
                </p>
              </div>
              <Switch
                checked={draft.scheduled}
                onCheckedChange={(scheduled) => setDraft({ ...draft, scheduled })}
                aria-label="Schedule report"
              />
            </div>
            {draft.scheduled && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Frequency</Label>
                  <Select
                    value={draft.frequency}
                    onValueChange={(v) => setDraft({ ...draft, frequency: v as Draft["frequency"] })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily (every morning)</SelectItem>
                      <SelectItem value="weekly">Weekly (Monday morning)</SelectItem>
                      <SelectItem value="monthly">Monthly (1st of the month)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="report-email">Send to</Label>
                  <Input
                    id="report-email"
                    type="email"
                    value={draft.recipient}
                    onChange={(e) => setDraft({ ...draft, recipient: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            {editingId && (
              <Button
                variant="ghost"
                onClick={() => {
                  setEditingId(null);
                  setDraft(EMPTY_DRAFT);
                }}
              >
                Cancel edit
              </Button>
            )}
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {saving ? "Saving…" : editingId ? "Save changes" : "Save report"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ---------- Inline report view ---------- */}
      {viewing && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span>
                {viewing.report.name}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {viewing.data.from} → {viewing.data.to}
                </span>
              </span>
              <span className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => download(viewing.report)}>
                  <Download className="size-3.5" /> CSV
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setViewing(null)}>
                  <X className="size-3.5" /> Close
                </Button>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {viewing.report.metrics.includes("revenue") && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <MetricCard label="Revenue" value={formatMoney(viewing.data.totalRevenue)} icon={FileText} hint={`${viewing.data.days} nights`} />
                  <MetricCard label="Orders" value={String(viewing.data.totalOrders)} icon={FileText} />
                  <MetricCard label="Avg order" value={formatMoney(viewing.data.avgOrderValue)} icon={FileText} />
                  <MetricCard label="Best night" value={formatMoney(viewing.data.bestNight.revenue)} icon={FileText} hint={viewing.data.bestNight.label} />
                </div>
                <MockChart
                  data={viewing.data.days > 21 ? aggregateWeekly(viewing.data.series) : viewing.data.series}
                  height={180}
                />
              </div>
            )}
            {viewing.report.metrics.includes("zones") && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Revenue by zone</p>
                {viewing.data.revenueByZone.map((z) => (
                  <div key={z.zoneId} className="flex justify-between border-b py-1.5 text-sm last:border-0">
                    <span>{z.zoneName}</span>
                    <span className="font-medium tabular-nums">{formatMoney(z.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
            {viewing.report.metrics.includes("top-items") && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Top items</p>
                {viewing.data.topItems.map((t) => (
                  <div key={t.name} className="flex justify-between border-b py-1.5 text-sm last:border-0">
                    <span>{t.name}</span>
                    <span className="text-muted-foreground">
                      {t.count} sold ·{" "}
                      <span className="font-medium text-foreground tabular-nums">{formatMoney(t.revenue)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
            {viewing.report.metrics.includes("staff") && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Staff performance</p>
                {viewing.data.staffPerformance.map((s) => (
                  <div key={s.staffId} className="flex items-center justify-between border-b py-1.5 text-sm last:border-0">
                    <span className="flex items-center gap-2">
                      {s.name} <RoleBadge role={s.role} className="px-1.5 py-0 text-[10px]" />
                    </span>
                    <span className="text-muted-foreground">
                      {s.ordersDelivered} orders ·{" "}
                      <span className="font-medium text-foreground tabular-nums">{formatMoney(s.revenueServed)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
            {viewing.report.metrics.includes("inventory") && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Inventory depletion</p>
                {viewing.data.categoryDepletion.map((c) => (
                  <div key={c.categoryId} className="flex justify-between border-b py-1.5 text-sm last:border-0">
                    <span>{c.categoryName}</span>
                    <span className="text-muted-foreground">
                      {c.unitsSold} sold · {c.unitsInStock} in stock
                      {c.sellThrough != null && ` · ${Math.round(c.sellThrough * 100)}% sell-through`}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {viewing.report.metrics.includes("sessions") && viewing.data.sessions && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Guest sessions</p>
                <div className="grid grid-cols-2 gap-2 text-sm lg:grid-cols-4">
                  <div><span className="text-muted-foreground">Sessions:</span> {viewing.data.sessions.totalSessions}</div>
                  <div><span className="text-muted-foreground">Approval:</span> {Math.round(viewing.data.sessions.approvalRate * 100)}%</div>
                  <div><span className="text-muted-foreground">Avg duration:</span> {viewing.data.sessions.avgDurationMinutes} min</div>
                  <div><span className="text-muted-foreground">Rev/session:</span> {formatMoney(viewing.data.sessions.revenuePerSession)}</div>
                </div>
              </div>
            )}
            {viewing.report.metrics.includes("reservations") && viewing.data.reservations && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Reservations</p>
                <div className="grid grid-cols-2 gap-2 text-sm lg:grid-cols-4">
                  <div><span className="text-muted-foreground">Requested:</span> {viewing.data.reservations.requested}</div>
                  <div><span className="text-muted-foreground">Seated:</span> {viewing.data.reservations.seated}</div>
                  <div><span className="text-muted-foreground">No-show:</span> {Math.round(viewing.data.reservations.noShowRate * 100)}%</div>
                  <div><span className="text-muted-foreground">Covers:</span> {viewing.data.reservations.totalCovers}</div>
                </div>
              </div>
            )}
            {viewing.report.metrics.includes("happy-hours") && viewing.data.happyHours && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Happy hours</p>
                <div className="grid grid-cols-2 gap-2 text-sm lg:grid-cols-3">
                  <div><span className="text-muted-foreground">HH orders:</span> {viewing.data.happyHours.totalHhOrders}</div>
                  <div><span className="text-muted-foreground">HH revenue:</span> {formatMoney(viewing.data.happyHours.totalHhRevenue)}</div>
                  <div><span className="text-muted-foreground">Discount:</span> {formatMoney(viewing.data.happyHours.totalDiscountGiven)}</div>
                </div>
              </div>
            )}
            {viewing.report.metrics.includes("events") && viewing.data.events && viewing.data.events.events.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Events</p>
                {viewing.data.events.events.map((e) => (
                  <div key={e.eventId} className="flex justify-between border-b py-1.5 text-sm last:border-0">
                    <span>{e.eventName}</span>
                    <span className="text-muted-foreground">
                      {e.checkedIn} checked in · {Math.round(e.capacityUtilization * 100)}% util ·{" "}
                      <span className="font-medium text-foreground tabular-nums">{formatMoney(e.eventRevenue)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
            {viewing.report.metrics.includes("promotions") && viewing.data.promotions && viewing.data.promotions.promotions.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Promotions</p>
                {viewing.data.promotions.promotions.map((p) => (
                  <div key={p.promotionId} className="flex justify-between border-b py-1.5 text-sm last:border-0">
                    <span>{p.code}</span>
                    <span className="text-muted-foreground">
                      {p.redemptions} used · {formatMoney(p.discountCost)} discount ·{" "}
                      <span className="font-medium text-foreground tabular-nums">{formatMoney(p.attributedRevenue)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
            {viewing.report.metrics.includes("order-funnel") && viewing.data.orderFunnel && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Order funnel</p>
                <div className="grid grid-cols-2 gap-2 text-sm lg:grid-cols-4">
                  <div><span className="text-muted-foreground">Placed:</span> {viewing.data.orderFunnel.placed}</div>
                  <div><span className="text-muted-foreground">Delivered:</span> {viewing.data.orderFunnel.delivered}</div>
                  <div><span className="text-muted-foreground">Cancelled:</span> {viewing.data.orderFunnel.cancelled} ({Math.round(viewing.data.orderFunnel.cancellationRate * 100)}%)</div>
                  <div><span className="text-muted-foreground">Fee revenue:</span> {formatMoney(viewing.data.orderFunnel.serviceFeeRevenue)}</div>
                </div>
              </div>
            )}
            {viewing.report.metrics.includes("service-fees") && viewing.data.orderFunnel && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Service fees</p>
                <div className="text-sm">
                  <span className="text-muted-foreground">Total fee revenue:</span>{" "}
                  <span className="font-medium tabular-nums">{formatMoney(viewing.data.orderFunnel.serviceFeeRevenue)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---------- Saved & scheduled reports ---------- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Saved & scheduled reports</CardTitle>
        </CardHeader>
        <CardContent>
          {reports === null ? (
            <ListSkeleton rows={3} rowHeight="h-12" />
          ) : reports.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No reports yet"
              description="Build one above — save it for on-demand runs or schedule it."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Metrics</TableHead>
                    <TableHead>Range</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Last run</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">{report.name}</TableCell>
                      <TableCell>
                        <div className="flex max-w-56 flex-wrap gap-1">
                          {report.metrics.map((m) => (
                            <Badge key={m} variant="outline" className="px-1.5 py-0 text-[10px]">
                              {metricLabel(m)}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {report.rangeDays} days
                      </TableCell>
                      <TableCell>
                        {report.schedule ? (
                          <Badge className="bg-primary/15 text-primary capitalize" variant="outline">
                            <CalendarClock className="size-3" /> {report.schedule.frequency}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">On demand</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {report.lastRunAt ? timeAgo(report.lastRunAt) : "Never"}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="View report"
                            disabled={runningId !== null}
                            onClick={() => view(report)}
                          >
                            {runningId === report.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Eye className="size-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Download CSV"
                            disabled={runningId !== null}
                            onClick={() => download(report)}
                          >
                            <Download className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Edit report"
                            onClick={() => startEdit(report)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <ConfirmDialog
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                                aria-label="Delete report"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            }
                            title={`Delete ${report.name}?`}
                            description={
                              report.schedule
                                ? "Its schedule is cancelled — no more automatic runs."
                                : "The saved configuration is removed."
                            }
                            confirmLabel="Delete report"
                            destructive
                            onConfirm={() => remove(report)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
