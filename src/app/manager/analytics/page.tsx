"use client";

import { FeatureGate } from "@/components/shared/feature-gate";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  ArrowRight, Boxes, CalendarCheck, CircleDollarSign,
  Clock, HandHelping, PartyPopper, Receipt, Tag, Timer, Trophy, Users,
  Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDateRangePicker } from "@/components/shared/calendar-date-range-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EntityChip } from "@/components/shared/entity-chip";
import { InfoTip } from "@/components/shared/info-tip";
import { MetricCard } from "@/components/shared/metric-card";
import { RevenueChart } from "@/components/shared/revenue-chart";
import { HorizontalBar } from "@/components/shared/horizontal-bar";
import { PageHeader } from "@/components/shared/page-header";
import { RoleBadge } from "@/components/shared/role-badge";
import {
  aggregateWeekly, analyticsService,
} from "@/features/analytics/analytics-service";
import { formatMoney, formatPct } from "@/features/shared/format";
import { cn } from "@/features/shared/utils";
import { REPORT_METRICS, type ReportMetric } from "@/lib/types";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { downloadCsv } from "@/features/shared/download-csv";
import { analyticsKeys } from "@/features/analytics/query-keys";
import { useAuth } from "@/context/auth-context";
import {
  ComparisonTab, ForecastTab, PerHourTab, FunnelTab, TableTurnTab,
  SlaTab, CompVoidTab, PromoterPerformanceTab, IncidentPatternTab,
  GuestRetentionTab, BottleServiceTab, CapacityUtilizationTab, NightSummaryTab,
} from "@/components/manager/analytics-depth";

const isoDaysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

const CATEGORY_KEY = "nlx-analytics-category";

/** One cell in a stat grid: muted label over a big tabular number. */
function Stat({ label, info, children }: { label: string; info?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground flex items-center gap-1">
        {label}
        {info && <InfoTip text={info} />}
      </p>
      <p className="text-lg font-semibold tabular-nums">{children}</p>
    </div>
  );
}

export default function ManagerAnalyticsPage() {
  return (
    <FeatureGate feature="analytics">
      <AnalyticsPageContent />
    </FeatureGate>
  );
}

function AnalyticsPageContent() {
  const t = useTranslations("manager.analytics");

  const ANALYTICS_CATEGORIES = [
    {
      id: "revenue",
      label: t("categories.revenue"),
      tabs: ["sales", "happy-hours", "promos", "bottles"],
    },
    {
      id: "operations",
      label: t("categories.operations"),
      tabs: ["capacity", "table-turn", "funnel", "sla", "inventory", "reservations"],
    },
    {
      id: "people",
      label: t("categories.people"),
      tabs: ["staff", "promoters", "guests"],
    },
    {
      id: "intelligence",
      label: t("categories.intelligence"),
      tabs: ["trends", "incidents", "summary"],
    },
  ] as const;
  type CategoryId = (typeof ANALYTICS_CATEGORIES)[number]["id"];

  function readSavedCategory(): CategoryId {
    try {
      const saved = localStorage.getItem(CATEGORY_KEY);
      if (saved && ANALYTICS_CATEGORIES.some((c) => c.id === saved)) {
        return saved as CategoryId;
      }
    } catch {}
    return "revenue";
  }

  const TAB_LABELS: Record<string, string> = {
    sales: t("tabs.sales"),
    "happy-hours": t("tabs.happy-hours"),
    promos: t("tabs.promos"),
    bottles: t("tabs.bottles"),
    capacity: t("tabs.capacity"),
    "table-turn": t("tabs.table-turn"),
    funnel: t("tabs.funnel"),
    sla: t("tabs.sla"),
    inventory: t("tabs.inventory"),
    reservations: t("tabs.reservations"),
    staff: t("tabs.staff"),
    promoters: t("tabs.promoters"),
    guests: t("tabs.guests"),
    trends: t("tabs.trends"),
    incidents: t("tabs.incidents"),
    summary: t("tabs.summary"),
  };

  const PRESETS = [
    { id: "7", label: t("presets.last7days"), days: 7 },
    { id: "30", label: t("presets.last30days"), days: 30 },
    { id: "90", label: t("presets.last90days"), days: 90 },
  ] as const;

  const { user } = useAuth();
  const venueId = user?.venueId ?? "";
  const [preset, setPreset] = useState<string>("7");
  const [from, setFrom] = useState(isoDaysAgo(6));
  const [to, setTo] = useState(isoDaysAgo(0));
  const [exporting, setExporting] = useState(false);
  const [category, setCategory] = useState<CategoryId>(readSavedCategory);
  const [tab, setTab] = useState<string>(
    ANALYTICS_CATEGORIES.find((c) => c.id === readSavedCategory())?.tabs[0] ?? "sales",
  );
  const [showCompDetails, setShowCompDetails] = useState(false);

  const { data } = useQuery({
    queryKey: analyticsKeys.historical(venueId, from, to),
    queryFn: () => analyticsService.getHistorical(from, to),
    enabled: !!venueId,
  });

  function applyPreset(id: string, days: number) {
    setPreset(id);
    setFrom(isoDaysAgo(days - 1));
    setTo(isoDaysAgo(0));
  }

  const chartSeries = useMemo(() => {
    if (!data) return [];
    return data.days > 21 ? aggregateWeekly(data.series) : data.series;
  }, [data]);

  const orderStaff = useMemo(
    () => data ? data.staffPerformance.filter((s) => s.role === "bartender" || s.role === "host") : [],
    [data],
  );
  const helpStaff = useMemo(
    () => data ? data.staffPerformance.filter((s) => s.role === "runner") : [],
    [data],
  );

  const fastestServer = useMemo(
    () => orderStaff.length > 0
      ? [...orderStaff].filter((s) => s.ordersDelivered > 0).sort((a, b) => a.avgDeliveryMinutes - b.avgDeliveryMinutes)[0]
      : undefined,
    [orderStaff],
  );
  const topEarner = useMemo(
    () => orderStaff.length > 0
      ? [...orderStaff].sort((a, b) => b.revenueServed - a.revenueServed)[0]
      : undefined,
    [orderStaff],
  );

  const zoneMax = data ? Math.max(...data.revenueByZone.map((z) => z.revenue)) : 1;
  const staffMax = orderStaff.length > 0 ? Math.max(...orderStaff.map((s) => s.ordersDelivered)) : 1;
  const depletionMax = data
    ? Math.max(...data.categoryDepletion.map((c) => c.unitsSold + c.unitsInStock))
    : 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("page.title")}
        description={t("page.description")}
        breadcrumbs={[{ label: t("page.breadcrumbInsights"), href: "/manager/reports" }, { label: t("page.breadcrumbAnalytics") }]}
      />

      {/* ---------- Range controls ---------- */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.id, p.days)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                preset === p.id
                  ? "border-primary bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <CalendarDateRangePicker
          from={from ? new Date(from + "T00:00:00") : undefined}
          to={to ? new Date(to + "T00:00:00") : undefined}
          onFromChange={(d) => {
            setPreset("custom");
            setFrom(d ? d.toISOString().slice(0, 10) : isoDaysAgo(6));
          }}
          onToChange={(d) => {
            setPreset("custom");
            setTo(d ? d.toISOString().slice(0, 10) : isoDaysAgo(0));
          }}
        />
        {/* AI-08: Export CSV */}
        <Button
          variant="outline"
          size="sm"
          disabled={exporting || !data}
          onClick={async () => {
            if (!data) return;
            setExporting(true);
            try {
              const allMetrics: ReportMetric[] = REPORT_METRICS.map((m) => m.id);
              const result = await analyticsService.exportReportCsv(
                `Analytics ${from} - ${to}`,
                allMetrics,
                from,
                to,
              );
              if (result.csvContent) {
                downloadCsv(result.csvContent, `analytics-${from}-to-${to}.csv`);
                toast.success(t("range.csvDownloaded"));
              }
            } catch {
              toast.error(t("range.exportFailed"));
            } finally {
              setExporting(false);
            }
          }}
        >
          <Download className="size-3.5" />
          {exporting ? t("range.exporting") : t("range.exportCsv")}
        </Button>
      </div>

      {data === undefined ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          {/* ---------- Category pills ---------- */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {ANALYTICS_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  if (category !== c.id) {
                    setCategory(c.id);
                    localStorage.setItem(CATEGORY_KEY, c.id);
                    setTab(c.tabs[0]);
                  }
                }}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all duration-200",
                  category === c.id
                    ? "border-primary bg-primary/15 text-primary scale-105"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          <TabsList className="!h-auto w-full flex-wrap gap-1 sm:!h-8 sm:w-fit sm:flex-nowrap sm:gap-0 transition-opacity duration-150" key={category}>
            {ANALYTICS_CATEGORIES
              .find((c) => c.id === category)
              ?.tabs.map((t) => (
                <TabsTrigger key={t} value={t} className="text-xs sm:text-sm">
                  {TAB_LABELS[t]}
                </TabsTrigger>
              ))}
          </TabsList>

          {/* ---------- Sales ---------- */}
          <TabsContent value="sales" className="space-y-6 pt-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard
                label={t("salesCards.revenue.label")}
                value={formatMoney(data.totalRevenue)}
                icon={CircleDollarSign}
                info={t("salesCards.revenue.info")}
                hint={t("common.nights", { days: data.days })}
              />
              <MetricCard label={t("salesCards.orders.label")} value={String(data.totalOrders)} icon={Receipt} info={t("salesCards.orders.info")} />
              <MetricCard label={t("salesCards.avgOrder.label")} value={formatMoney(data.avgOrderValue)} icon={CircleDollarSign} info={t("salesCards.avgOrder.info")} />
              <MetricCard
                label={t("salesCards.bestNight.label")}
                value={formatMoney(data.bestNight.revenue)}
                icon={Trophy}
                info={t("salesCards.bestNight.info")}
                hint={data.bestNight.label}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t("sales.revenueChartTitle")} {data.days > 21 ? t("sales.byWeek") : t("sales.byNight")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RevenueChart data={chartSeries} height={220} />
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("sales.revenueByZone")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.revenueByZone.map((zone) => (
                    <HorizontalBar
                      key={zone.zoneId}
                      left={<EntityChip type="zone-tables" id={zone.zoneId} label={zone.zoneName} />}
                      right={<span className="font-medium tabular-nums">{formatMoney(zone.revenue)}</span>}
                      ratio={zone.revenue / zoneMax}
                    />
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("sales.topItems")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {data.topItems.map((item, i) => (
                      <li key={item.name} className="flex items-center gap-3 text-sm">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/15 text-xs font-bold text-primary">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {item.categoryId ? (
                            <EntityChip type="menu-category" id={item.categoryId} label={item.name} />
                          ) : (
                            item.name
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">{item.count} {t("sales.sold")}</span>
                        <span className="font-medium tabular-nums">{formatMoney(item.revenue)}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Order funnel (deepened) */}
            {data.orderFunnel && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("sales.orderFunnel")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm lg:grid-cols-4">
                    <Stat label={t("sales.funnel.placed.label")} info={t("sales.funnel.placed.info")}>{data.orderFunnel.placed}</Stat>
                    <Stat label={t("sales.funnel.delivered.label")} info={t("sales.funnel.delivered.info")}>{data.orderFunnel.delivered}</Stat>
                    <Stat label={t("sales.funnel.cancelled.label")} info={t("sales.funnel.cancelled.info")}>{data.orderFunnel.cancelled}{" "}
                        <span className="text-xs text-muted-foreground">({formatPct(data.orderFunnel.cancellationRate)})</span></Stat>
                    <Stat label={t("sales.funnel.serviceFee.label")} info={t("sales.funnel.serviceFee.info")}>{formatMoney(data.orderFunnel.serviceFeeRevenue)}</Stat>
                    <Stat label={t("sales.funnel.tipRate.label")} info={t("sales.funnel.tipRate.info")}>{formatPct(data.orderFunnel.tipRate)}</Stat>
                    <Stat label={t("sales.funnel.avgTip.label")} info={t("sales.funnel.avgTip.info")}>{formatMoney(data.orderFunnel.avgTip)}</Stat>
                    <Stat label={t("sales.funnel.giftOrders.label")} info={t("sales.funnel.giftOrders.info")}>{data.orderFunnel.giftOrders}{" "}
                        <span className="text-xs text-muted-foreground">({formatMoney(data.orderFunnel.giftRevenue)})</span></Stat>
                    <Stat label={t("sales.funnel.modifierAttach.label")} info={t("sales.funnel.modifierAttach.info")}>{formatPct(data.orderFunnel.modifierAttachRate)}</Stat>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Comps, voids & discounts */}
            {data.adjustments && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("sales.compVoid.title")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm lg:grid-cols-3">
                    <Stat label={t("sales.compVoid.voids.label")} info={t("sales.compVoid.voids.info")}>
                      {data.adjustments.voidCount}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({formatMoney(data.adjustments.voidCents / 100)} · {formatPct(data.adjustments.voidRate)})
                      </span>
                    </Stat>
                    <Stat label={t("sales.compVoid.comps.label")} info={t("sales.compVoid.comps.info")}>
                      {data.adjustments.compCount}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({formatMoney(data.adjustments.compCents / 100)} · {formatPct(data.adjustments.compRate)})
                      </span>
                    </Stat>
                    <Stat label={t("sales.compVoid.discounts.label")} info={t("sales.compVoid.discounts.info")}>
                      {data.adjustments.discountCount}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({formatMoney(data.adjustments.discountCents / 100)} · {formatPct(data.adjustments.discountRate)})
                      </span>
                    </Stat>
                  </div>
                  {data.adjustments.byReason.length > 0 && (
                    <div className="space-y-1 border-t pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("sales.compVoid.byReason")}</p>
                      {data.adjustments.byReason.map((r) => (
                        <div key={`${r.kind}:${r.reasonCode}`} className="flex justify-between text-sm">
                          <span className="capitalize text-muted-foreground">{r.kind} · {r.reasonCode}</span>
                          <span className="tabular-nums">{r.count} · {formatMoney(r.amountCents / 100)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            {/* Per-staff comp/void monitoring */}
            {data.adjustments && (
              <>
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCompDetails(!showCompDetails)}
                  >
                    {showCompDetails ? t("sales.compVoid.hidePerStaff") : t("sales.compVoid.showPerStaff")}
                  </Button>
                </div>
                {showCompDetails && <CompVoidTab />}
              </>
            )}
          </TabsContent>

          {/* ---------- Staff ---------- */}
          <TabsContent value="staff" className="space-y-6 pt-4">
            {/* Order ETA cards */}
            {data.orderEta && (
              <div className="grid grid-cols-3 gap-3">
                <MetricCard
                  label={t("staffCards.avgAcceptWait.label")}
                  value={`${data.orderEta.avgAcceptMinutes} ${t("common.min")}`}
                  icon={Timer}
                  info={t("staffCards.avgAcceptWait.info")}
                />
                <MetricCard
                  label={t("staffCards.avgPrepDelivery.label")}
                  value={`${data.orderEta.avgPrepMinutes} ${t("common.min")}`}
                  icon={Timer}
                  info={t("staffCards.avgPrepDelivery.info")}
                />
                <MetricCard
                  label={t("staffCards.avgTotalEta.label")}
                  value={`${data.orderEta.avgTotalMinutes} ${t("common.min")}`}
                  icon={Timer}
                  info={t("staffCards.avgTotalEta.info")}
                  featured
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard
                label={t("staffCards.ordersDelivered.label")}
                value={String(orderStaff.reduce((s, p) => s + p.ordersDelivered, 0))}
                icon={Receipt}
                info={t("staffCards.ordersDelivered.info")}
                hint={t("common.nights", { days: data.days })}
              />
              <MetricCard
                label={t("staffCards.revenueServed.label")}
                value={formatMoney(orderStaff.reduce((s, p) => s + p.revenueServed, 0))}
                icon={CircleDollarSign}
                info={t("staffCards.revenueServed.info")}
              />
              <MetricCard
                label={t("staffCards.fastestServer.label")}
                value={fastestServer?.name.split(" ")[0] ?? "—"}
                icon={Users}
                info={t("staffCards.fastestServer.info")}
                hint={t("common.minAvg", { mins: fastestServer?.avgDeliveryMinutes ?? 0 })}
              />
              <MetricCard
                label={t("staffCards.topEarner.label")}
                value={topEarner?.name.split(" ")[0] ?? "—"}
                icon={Trophy}
                info={t("staffCards.topEarner.info")}
                hint={t("staff.byRevenueServed")}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("staff.ordersPerServer")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {orderStaff
                  .slice()
                  .sort((a, b) => b.ordersDelivered - a.ordersDelivered)
                  .map((perf) => (
                    <HorizontalBar
                      key={perf.staffId}
                      left={
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate">{perf.name}</span>
                          <RoleBadge role={perf.role} className="px-1.5 py-0 text-[10px]" />
                        </span>
                      }
                      right={
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {perf.ordersDelivered} {t("common.orders")} · {t("common.minAvg", { mins: perf.avgDeliveryMinutes })} ·{" "}
                          <span className="font-medium text-foreground tabular-nums">
                            {formatMoney(perf.revenueServed)}
                          </span>
                        </span>
                      }
                      ratio={perf.ordersDelivered / staffMax}
                    />
                  ))}
              </CardContent>
            </Card>

            {/* Order fulfilment — bartenders & hosts */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("staff.orderFulfilment")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">{t("staff.orderFulfilmentHeaders.name")}</th>
                        <th className="pb-2 pr-4 font-medium">{t("staff.orderFulfilmentHeaders.role")}</th>
                        <th className="pb-2 pr-4 text-right font-medium">{t("staff.orderFulfilmentHeaders.acceptWait")}</th>
                        <th className="pb-2 pr-4 text-right font-medium">{t("staff.orderFulfilmentHeaders.delivery")}</th>
                        <th className="pb-2 pr-4 text-right font-medium">{t("staff.orderFulfilmentHeaders.revenue")}</th>
                        <th className="pb-2 text-right font-medium">{t("staff.orderFulfilmentHeaders.ordersPerHr")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderStaff.map((p) => (
                        <tr key={p.staffId} className="border-b last:border-0">
                          <td className="py-2 pr-4">{p.name}</td>
                          <td className="py-2 pr-4"><RoleBadge role={p.role} className="px-1.5 py-0 text-[10px]" /></td>
                          <td className="py-2 pr-4 text-right tabular-nums">{p.avgAcceptMinutes ?? "—"} {t("common.min")}</td>
                          <td className="py-2 pr-4 text-right tabular-nums">{p.avgDeliveryMinutes} {t("common.min")}</td>
                          <td className="py-2 pr-4 text-right tabular-nums">{formatMoney(p.revenueServed)}</td>
                          <td className="py-2 text-right tabular-nums">{p.ordersPerShiftHour ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Help fulfilment — runners */}
            {helpStaff.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <HandHelping className="size-4 text-primary" /> {t("staff.helpFulfilment")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-2 pr-4 font-medium">{t("staff.helpFulfilmentHeaders.name")}</th>
                          <th className="pb-2 pr-4 font-medium">{t("staff.helpFulfilmentHeaders.role")}</th>
                          <th className="pb-2 pr-4 text-right font-medium">{t("staff.helpFulfilmentHeaders.helpResolved")}</th>
                          <th className="pb-2 text-right font-medium">{t("staff.helpFulfilmentHeaders.avgHelpMin")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {helpStaff.map((p) => (
                          <tr key={p.staffId} className="border-b last:border-0">
                            <td className="py-2 pr-4">{p.name}</td>
                            <td className="py-2 pr-4"><RoleBadge role={p.role} className="px-1.5 py-0 text-[10px]" /></td>
                            <td className="py-2 pr-4 text-right tabular-nums">{p.helpResolved ?? 0}</td>
                            <td className="py-2 text-right tabular-nums">{p.avgHelpMinutes ?? "—"} {t("common.min")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/manager/staff">
                  {t("staff.manageStaff")} <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </TabsContent>

          {/* ---------- Inventory ---------- */}
          <TabsContent value="inventory" className="space-y-6 pt-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard
                label={t("inventoryCards.unitsSold.label")}
                value={String(data.categoryDepletion.reduce((s, c) => s + c.unitsSold, 0))}
                icon={Boxes}
                info={t("inventoryCards.unitsSold.info")}
                hint={t("common.nights", { days: data.days })}
              />
              <MetricCard
                label={t("inventoryCards.topCategory.label")}
                value={
                  [...data.categoryDepletion].sort((a, b) => b.unitsSold - a.unitsSold)[0]
                    ?.categoryName ?? "—"
                }
                icon={Trophy}
                info={t("inventoryCards.topCategory.info")}
              />
              <MetricCard
                label={t("inventoryCards.avgUnitsPerNight.label")}
                value={String(
                  Math.round(
                    data.categoryDepletion.reduce((s, c) => s + c.unitsSold, 0) / data.days,
                  ),
                )}
                icon={Receipt}
                info={t("inventoryCards.avgUnitsPerNight.info")}
              />
              <MetricCard
                label={t("inventoryCards.inStock.label")}
                value={String(data.categoryDepletion.reduce((s, c) => s + c.unitsInStock, 0))}
                icon={Boxes}
                info={t("inventoryCards.inStock.info")}
                hint={t("common.liveCount")}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("inventory.soldVsStock")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.categoryDepletion.map((cat) => (
                  <div key={cat.categoryId} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <EntityChip type="menu-category" id={cat.categoryId} label={cat.categoryName} />
                      <span className="text-xs text-muted-foreground">
                        {cat.unitsSold} {t("common.sold")} · {cat.unitsInStock} {t("common.left")}
                        {cat.sellThrough != null && ` · ${formatPct(cat.sellThrough)} ${t("common.sellThrough")}`}
                      </span>
                    </div>
                    <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${(cat.unitsSold / depletionMax) * 100}%` }}
                      />
                      <div
                        className="h-full bg-primary/30"
                        style={{ width: `${(cat.unitsInStock / depletionMax) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                <p className="text-[11px] text-muted-foreground">
                  <span className="mr-1 inline-block size-2 rounded-full bg-primary" /> {t("inventory.soldInRange")}
                  <span className="ml-3 mr-1 inline-block size-2 rounded-full bg-primary/30" /> {t("inventory.remaining")}
                </p>
              </CardContent>
            </Card>

            {/* Deepened: inventory depth */}
            {data.inventoryDepth && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("inventory.depthTitle")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm lg:grid-cols-4">
                    <Stat label={t("inventory.depth.soldOutPerNight.label")} info={t("inventory.depth.soldOutPerNight.info")}>{data.inventoryDepth.soldOutEventsPerNight}</Stat>
                    <Stat label={t("inventory.depth.soldOutMinutes.label")} info={t("inventory.depth.soldOutMinutes.info")}>{data.inventoryDepth.totalSoldOutMinutes}</Stat>
                    <Stat label={t("inventory.depth.restockRatio.label")} info={t("inventory.depth.restockRatio.info")}>{formatPct(data.inventoryDepth.restockSaleRatio)}</Stat>
                    <Stat label={t("inventory.depth.deadItems.label")} info={t("inventory.depth.deadItems.info")}>{data.inventoryDepth.deadItems}</Stat>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/manager/inventory">
                  {t("inventory.openInventory")} <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </TabsContent>

          {/* ---------- Guests (Sessions + Retention) ---------- */}
          <TabsContent value="guests" className="space-y-6 pt-4">
            {data.sessions ? (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <MetricCard label={t("guestsCards.sessions.label")} value={String(data.sessions.totalSessions)} icon={Users} info={t("guestsCards.sessions.info")} hint={t("common.nights", { days: data.days })} />
                  <MetricCard label={t("guestsCards.approvalRate.label")} value={formatPct(data.sessions.approvalRate)} icon={Users} info={t("guestsCards.approvalRate.info")} />
                  <MetricCard label={t("guestsCards.avgDuration.label")} value={`${data.sessions.avgDurationMinutes} ${t("common.min")}`} icon={Clock} info={t("guestsCards.avgDuration.info")} />
                  <MetricCard label={t("guestsCards.revPerSession.label")} value={formatMoney(data.sessions.revenuePerSession)} icon={CircleDollarSign} info={t("guestsCards.revPerSession.info")} />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{t("guests.sessionMetrics")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                        <Stat label={t("guests.denialRate.label")} info={t("guests.denialRate.info")}>{formatPct(data.sessions.denialRate)}</Stat>
                        <Stat label={t("guests.avgApprovalWait.label")} info={t("guests.avgApprovalWait.info")}>{data.sessions.avgApprovalMinutes} {t("common.min")}</Stat>
                        <Stat label={t("guests.avgPartySize.label")} info={t("guests.avgPartySize.info")}>{data.sessions.avgPartySize}</Stat>
                        <Stat label={t("guests.revPerGuest.label")} info={t("guests.revPerGuest.info")}>{formatMoney(data.sessions.revenuePerGuest)}</Stat>
                        <Stat label={t("guests.avgClosureTime.label")} info={t("guests.avgClosureTime.info")}>{data.sessions.avgClosureMinutes} {t("common.min")}</Stat>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{t("guests.tabSettlement")}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {t("guests.tabSettlementDesc")}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {data.sessions.settlementMix.map((s) => (
                        <HorizontalBar
                          key={s.method}
                          left={<span className="capitalize">{s.method}</span>}
                          right={
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {s.count} ({formatPct(s.pct)})
                            </span>
                          }
                          ratio={s.pct}
                        />
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t("guests.empty")}</p>
            )}
            {/* Guest retention metrics */}
            <div className="border-t pt-4 mt-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("guests.lifecycle")}
              </p>
            </div>
            <GuestRetentionTab />
          </TabsContent>

          {/* ---------- Reservations ---------- */}
          <TabsContent value="reservations" className="space-y-6 pt-4">
            {data.reservations ? (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <MetricCard label={t("reservationsCards.requested.label")} value={String(data.reservations.requested)} icon={CalendarCheck} info={t("reservationsCards.requested.info")} />
                  <MetricCard label={t("reservationsCards.seated.label")} value={String(data.reservations.seated)} icon={CalendarCheck} info={t("reservationsCards.seated.info")} hint={`${formatPct(data.reservations.seatedRate)} ${t("common.ofConfirmed")}`} />
                  <MetricCard label={t("reservationsCards.noShowRate.label")} value={formatPct(data.reservations.noShowRate)} icon={Users} info={t("reservationsCards.noShowRate.info")} hint={t("common.ofConfirmed")} />
                  <MetricCard label={t("reservationsCards.totalCovers.label")} value={String(data.reservations.totalCovers)} icon={Users} info={t("reservationsCards.totalCovers.info")} />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{t("reservations.funnel")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                        <Stat label={t("reservations.funnelStats.confirmed.label")} info={t("reservations.funnelStats.confirmed.info")}>{data.reservations.confirmed} <span className="text-xs text-muted-foreground">({formatPct(data.reservations.confirmRate)} {t("common.ofRequested")})</span></Stat>
                        <Stat label={t("reservations.funnelStats.completed.label")} info={t("reservations.funnelStats.completed.info")}>{data.reservations.completed}</Stat>
                        <Stat label={t("reservations.funnelStats.cancelled.label")} info={t("reservations.funnelStats.cancelled.info")}>{data.reservations.cancelled} <span className="text-xs text-muted-foreground">({formatPct(data.reservations.cancellationRate)} {t("common.ofRequested")})</span></Stat>
                        <Stat label={t("reservations.funnelStats.avgLeadTime.label")} info={t("reservations.funnelStats.avgLeadTime.info")}>{data.reservations.avgLeadDays} {t("common.reservationDays")}</Stat>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{t("reservations.sourceSplit")}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {data.reservations.sourceSplit.map((s) => (
                        <HorizontalBar
                          key={s.source}
                          left={<span className="capitalize">{s.source}</span>}
                          right={
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {s.count} ({formatPct(s.pct)})
                            </span>
                          }
                          ratio={s.pct}
                        />
                      ))}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t("reservations.channelBreakdown")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {data.reservations.channelSplit.map((c) => (
                      <HorizontalBar
                        key={c.channel}
                        left={<span className="capitalize">{c.channel}</span>}
                        right={
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {c.count} ({formatPct(c.pct)})
                          </span>
                        }
                        ratio={c.pct}
                      />
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t("reservations.partySizeDist")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end gap-2">
                      {data.reservations.partySizeDistribution.map((p) => {
                        const maxCount = Math.max(...data.reservations!.partySizeDistribution.map((d) => d.count));
                        return (
                          <div key={p.size} className="flex flex-1 flex-col items-center gap-1">
                            <div
                              className="w-full rounded-t bg-primary/80"
                              style={{ height: `${Math.max(4, (p.count / maxCount) * 100)}px` }}
                            />
                            <span className="text-[11px] text-muted-foreground">{p.size}</span>
                            <span className="text-[11px] font-medium tabular-nums">{p.count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/manager/reservations">
                      {t("reservations.manage")} <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t("reservations.empty")}</p>
            )}
          </TabsContent>

          {/* ---------- Happy Hours ---------- */}
          <TabsContent value="happy-hours" className="space-y-6 pt-4">
            {data.happyHours ? (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <MetricCard label={t("happyHoursCards.hhOrders.label")} value={String(data.happyHours.totalHhOrders)} icon={Receipt} info={t("happyHoursCards.hhOrders.info")} />
                  <MetricCard label={t("happyHoursCards.hhRevenue.label")} value={formatMoney(data.happyHours.totalHhRevenue)} icon={CircleDollarSign} info={t("happyHoursCards.hhRevenue.info")} />
                  <MetricCard label={t("happyHoursCards.discountGiven.label")} value={formatMoney(data.happyHours.totalDiscountGiven)} icon={CircleDollarSign} info={t("happyHoursCards.discountGiven.info")} />
                  <MetricCard label={t("happyHoursCards.rulesActive.label")} value={String(data.happyHours.rules.length)} icon={Clock} info={t("happyHoursCards.rulesActive.info")} />
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t("happyHours.perRule")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-2 pr-4 font-medium">{t("happyHours.tableHeaders.rule")}</th>
                            <th className="pb-2 pr-4 text-right font-medium">{t("happyHours.tableHeaders.orders")}</th>
                            <th className="pb-2 pr-4 text-right font-medium">{t("happyHours.tableHeaders.revenue")}</th>
                            <th className="pb-2 pr-4 text-right font-medium">{t("happyHours.tableHeaders.discount")}</th>
                            <th className="pb-2 text-right font-medium">{t("happyHours.tableHeaders.categoryUplift")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.happyHours.rules.map((r) => (
                            <tr key={r.ruleId} className="border-b last:border-0">
                              <td className="py-2 pr-4">{r.ruleName}</td>
                              <td className="py-2 pr-4 text-right tabular-nums">{r.orders}</td>
                              <td className="py-2 pr-4 text-right tabular-nums">{formatMoney(r.revenue)}</td>
                              <td className="py-2 pr-4 text-right tabular-nums">{formatMoney(r.discountGiven)}</td>
                              <td className="py-2 text-right tabular-nums">{formatPct(r.categoryUpliftPct)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t("happyHours.empty")}</p>
            )}
          </TabsContent>

          {/* ---------- Promos (Events + Promotions) ---------- */}
          <TabsContent value="promos" className="space-y-6 pt-4">
            {/* Events */}
            {data.events && data.events.events.length > 0 && (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <MetricCard label={t("promos.events.eventsLabel.label")} value={String(data.events.totalEvents)} icon={PartyPopper} info={t("promos.events.eventsLabel.info")} />
                  <MetricCard label={t("promos.events.avgUtilization.label")} value={formatPct(data.events.avgCapacityUtilization)} icon={Users} info={t("promos.events.avgUtilization.info")} />
                </div>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t("promos.events.perEvent")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-2 pr-4 font-medium">{t("promos.events.tableHeaders.event")}</th>
                            <th className="pb-2 pr-4 text-right font-medium">{t("promos.events.tableHeaders.invited")}</th>
                            <th className="pb-2 pr-4 text-right font-medium">{t("promos.events.tableHeaders.confirmed")}</th>
                            <th className="pb-2 pr-4 text-right font-medium">{t("promos.events.tableHeaders.checkedIn")}</th>
                            <th className="pb-2 pr-4 text-right font-medium">{t("promos.events.tableHeaders.utilization")}</th>
                            <th className="pb-2 pr-4 text-right font-medium">{t("promos.events.tableHeaders.eventRev")}</th>
                            <th className="pb-2 text-right font-medium">{t("promos.events.tableHeaders.avgWeekdayRev")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.events.events.map((e) => (
                            <tr key={e.eventId} className="border-b last:border-0">
                              <td className="py-2 pr-4">
                                <EntityChip type="event" id={e.eventId} label={e.eventName} />
                              </td>
                              <td className="py-2 pr-4 text-right tabular-nums">{e.invited}</td>
                              <td className="py-2 pr-4 text-right tabular-nums">{e.confirmed}</td>
                              <td className="py-2 pr-4 text-right tabular-nums">{e.checkedIn}</td>
                              <td className="py-2 pr-4 text-right tabular-nums">{formatPct(e.capacityUtilization)}</td>
                              <td className="py-2 pr-4 text-right tabular-nums">{formatMoney(e.eventRevenue)}</td>
                              <td className="py-2 text-right tabular-nums">{formatMoney(e.avgWeekdayRevenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/manager/events">
                      {t("promos.events.manageEvents")} <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              </>
            )}
            {!(data.events && data.events.events.length > 0) && (
              <p className="text-sm text-muted-foreground">{t("promos.events.empty")}</p>
            )}

            {/* Promotions */}
            {data.promotions && data.promotions.promotions.length > 0 ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t("promos.promotions.title")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                      <MetricCard label={t("promos.promotions.redemptions.label")} value={String(data.promotions.totalRedemptions)} icon={Tag} info={t("promos.promotions.redemptions.info")} />
                      <MetricCard label={t("promos.promotions.discountCost.label")} value={formatMoney(data.promotions.totalDiscountCost)} icon={CircleDollarSign} info={t("promos.promotions.discountCost.info")} />
                    </div>
                    <div className="border-t pt-4">
                      <p className="text-sm font-medium mb-3">{t("promos.promotions.perPromotion")}</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="pb-2 pr-4 font-medium">{t("promos.promotions.tableHeaders.code")}</th>
                              <th className="pb-2 pr-4 text-right font-medium">{t("promos.promotions.tableHeaders.redemptions")}</th>
                              <th className="pb-2 pr-4 text-right font-medium">{t("promos.promotions.tableHeaders.discountCost")}</th>
                              <th className="pb-2 pr-4 text-right font-medium">{t("promos.promotions.tableHeaders.attributedRev")}</th>
                              <th className="pb-2 pr-4 text-right font-medium">{t("promos.promotions.tableHeaders.aovWith")}</th>
                              <th className="pb-2 text-right font-medium">{t("promos.promotions.tableHeaders.aovWithout")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.promotions.promotions.map((p) => (
                              <tr key={p.promotionId} className="border-b last:border-0">
                                <td className="py-2 pr-4">
                                  <EntityChip type="promotion" id={p.promotionId} label={p.code} />
                                </td>
                                <td className="py-2 pr-4 text-right tabular-nums">{p.redemptions}</td>
                                <td className="py-2 pr-4 text-right tabular-nums">{formatMoney(p.discountCost)}</td>
                                <td className="py-2 pr-4 text-right tabular-nums">{formatMoney(p.attributedRevenue)}</td>
                                <td className="py-2 pr-4 text-right tabular-nums">{formatMoney(p.aovWithPromo)}</td>
                                <td className="py-2 text-right tabular-nums">{formatMoney(p.aovWithoutPromo)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/manager/promotions">
                      {t("promos.promotions.manage")} <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t("promos.promotions.empty")}</p>
            )}
          </TabsContent>

          {/* ---------- Promoters ---------- */}
          <TabsContent value="promoters" className="space-y-6 pt-4">
            {data.promoters && data.promoters.promoters.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <MetricCard
                    label={t("promotersCards.totalAttributed.label")}
                    value={formatMoney(data.promoters.totalAttributedRevenue)}
                    icon={CircleDollarSign}
                    info={t("promotersCards.totalAttributed.info")}
                    hint={t("common.nights", { days: data.days })}
                  />
                  <MetricCard
                    label={t("promotersCards.guestsFunneled.label")}
                    value={String(data.promoters.totalGuestsFunneled)}
                    icon={Users}
                    info={t("promotersCards.guestsFunneled.info")}
                  />
                  <MetricCard
                    label={t("promotersCards.topPromoter.label")}
                    value={
                      [...data.promoters.promoters].sort((a, b) => b.attributedRevenue - a.attributedRevenue)[0]
                        ?.promoterName.split(" ")[0] ?? "—"
                    }
                    icon={Trophy}
                    info={t("promotersCards.topPromoter.info")}
                    hint={t("common.byRevenue")}
                  />
                  <MetricCard
                    label={t("promotersCards.avgShowUp.label")}
                    value={formatPct(
                      data.promoters.promoters.reduce((s, p) => s + p.showUpRate, 0) / data.promoters.promoters.length,
                    )}
                    icon={CalendarCheck}
                    info={t("promotersCards.avgShowUp.info")}
                  />
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t("promoters.leaderboard")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {(() => {
                      const sorted = [...data.promoters!.promoters].sort((a, b) => b.attributedRevenue - a.attributedRevenue);
                      const maxRev = sorted[0]?.attributedRevenue ?? 1;
                      return sorted.map((p) => (
                        <HorizontalBar
                          key={p.promoterId}
                          left={
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="truncate">{p.promoterName}</span>
                              <RoleBadge role="promoter" className="px-1.5 py-0 text-[10px]" />
                            </span>
                          }
                          right={
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {p.guestsFunneled} {t("common.guests")} ·{" "}
                              <span className="font-medium text-foreground tabular-nums">
                                {formatMoney(p.attributedRevenue)}
                              </span>
                            </span>
                          }
                          ratio={p.attributedRevenue / maxRev}
                        />
                      ));
                    })()}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t("promoters.funnelByPromoter")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-2 pr-4 font-medium">{t("promoters.funnelHeaders.promoter")}</th>
                            <th className="pb-2 pr-4 text-right font-medium">{t("promoters.funnelHeaders.created")}</th>
                            <th className="pb-2 pr-4 text-right font-medium">{t("promoters.funnelHeaders.confirmed")}</th>
                            <th className="pb-2 pr-4 text-right font-medium">{t("promoters.funnelHeaders.seated")}</th>
                            <th className="pb-2 pr-4 text-right font-medium">{t("promoters.funnelHeaders.showUp")}</th>
                            <th className="pb-2 pr-4 text-right font-medium">{t("promoters.funnelHeaders.guests")}</th>
                            <th className="pb-2 pr-4 text-right font-medium">{t("promoters.funnelHeaders.revenue")}</th>
                            <th className="pb-2 text-right font-medium">{t("promoters.funnelHeaders.avgPerGuest")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.promoters!.promoters.map((p) => (
                            <tr key={p.promoterId} className="border-b last:border-0">
                              <td className="py-2 pr-4">{p.promoterName}</td>
                              <td className="py-2 pr-4 text-right tabular-nums">{p.reservationsCreated}</td>
                              <td className="py-2 pr-4 text-right tabular-nums">{p.reservationsConfirmed}</td>
                              <td className="py-2 pr-4 text-right tabular-nums">{p.reservationsSeated}</td>
                              <td className="py-2 pr-4 text-right tabular-nums">{formatPct(p.showUpRate)}</td>
                              <td className="py-2 pr-4 text-right tabular-nums">{p.guestsFunneled}</td>
                              <td className="py-2 pr-4 text-right tabular-nums">{formatMoney(p.attributedRevenue)}</td>
                              <td className="py-2 text-right tabular-nums">{formatMoney(p.avgSpendPerGuest)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t("promoters.empty")}</p>
            )}
            {/* Detailed promoter performance */}
            <div className="border-t pt-4 mt-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("promoters.detailPerf")}
              </p>
            </div>
            <PromoterPerformanceTab />
          </TabsContent>

          {/* ---------- Phase 4: Analytics Depth (merged) ---------- */}

          <TabsContent value="trends"><ComparisonTab /><ForecastTab /></TabsContent>
          <TabsContent value="capacity"><CapacityUtilizationTab /><PerHourTab /></TabsContent>
          <TabsContent value="funnel"><FunnelTab /></TabsContent>
          <TabsContent value="table-turn"><TableTurnTab /></TabsContent>
          <TabsContent value="sla"><SlaTab /></TabsContent>
          <TabsContent value="incidents"><IncidentPatternTab /></TabsContent>
          <TabsContent value="bottles"><BottleServiceTab /></TabsContent>
          <TabsContent value="summary"><NightSummaryTab /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}
