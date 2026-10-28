"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle, ArrowDown, Beer, CircleDollarSign, Clock, ClipboardList, DoorOpen,
  Gauge, Megaphone, PartyPopper, Percent, Receipt, Shield,
  Table, Target, Timer, TrendingUp, UserCheck, Users, Wine,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EntityChip } from "@/components/shared/entity-chip";
import { InfoTip } from "@/components/shared/info-tip";
import { MetricCard } from "@/components/shared/metric-card";
import { RoleBadge } from "@/components/shared/role-badge";
import {
  analyticsService,
} from "@/features/analytics/analytics-service";
import type {
  NightComparison,
  NightForecast,
  PerHourAnalytics,
  DoorToTableFunnel,
  TableTurnAnalytics,
  OrderSlaAnalytics,
  CompVoidRatioAnalytics,
  PromoterPerformanceReport,
  IncidentPatternReport,
  GuestRetentionMetrics,
  BottleServiceAnalytics,
  CapacityUtilizationAnalytics,
  NightSummary,
} from "@/lib/types";
import { formatMoney, formatPct } from "@/features/shared/format";

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

import { HorizontalBar } from "@/components/shared/horizontal-bar";

const isoDaysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

/**
 * Tab analytics through TanStack Query — cached per endpoint, so switching
 * tabs (and back) never refetches. Replaces the per-tab useEffect + setData.
 */
function useAnalytics<T>(method: string, fn: () => Promise<T>): T | null {
  const { data } = useQuery({
    queryKey: ["analytics-depth", method],
    queryFn: fn,
  });
  return data ?? null;
}

// ---------- Each AI tab gets its own loader + render ----------

/** AI-01: Night-over-night comparison. */
export function ComparisonTab() {
  const t = useTranslations("shared");
  const data = useAnalytics("getNightComparison", () => analyticsService.getNightComparison());
  if (!data) return <Skeleton className="h-64 rounded-xl" />;
  const { current, reference, deltas, referenceLabel } = data;
  const deltaColor = (v: number) => v >= 0 ? "text-emerald-400" : "text-rose-400";
  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label={t("analyticsDepth.comparison.revenueTonight")} value={formatMoney(current.revenue)} icon={CircleDollarSign} info={t("analyticsDepth.comparison.revenueTonightInfo")} />
        <MetricCard label={t("analyticsDepth.comparison.ordersTonight")} value={String(current.orders)} icon={Receipt} info={t("analyticsDepth.comparison.ordersTonightInfo")} />
        <MetricCard label={t("analyticsDepth.comparison.coversTonight")} value={String(current.covers)} icon={Users} info={t("analyticsDepth.comparison.coversTonightInfo")} />
        <MetricCard label={t("analyticsDepth.comparison.avgOrderValue")} value={formatMoney(current.avgOrderValue)} icon={Target} info={t("analyticsDepth.comparison.avgOrderValueInfo")} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{referenceLabel}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm lg:grid-cols-4">
            <Stat label={t("analyticsDepth.comparison.referenceRevenue")}>{formatMoney(reference.revenue)}</Stat>
            <Stat label={t("analyticsDepth.comparison.referenceOrders")} info={t("analyticsDepth.comparison.referenceOrdersInfo", { label: referenceLabel })}>{reference.orders}</Stat>
            <Stat label={t("analyticsDepth.comparison.referenceCovers")}>{reference.covers}</Stat>
            <Stat label={t("analyticsDepth.comparison.referenceAOV")}>{formatMoney(reference.avgOrderValue)}</Stat>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("analyticsDepth.comparison.deltas")}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm lg:grid-cols-4">
            <Stat label={t("analyticsDepth.comparison.revenueDelta")}><span className={deltaColor(deltas.revenuePct)}>{deltas.revenuePct > 0 ? "+" : ""}{deltas.revenuePct.toFixed(1)}%</span></Stat>
            <Stat label={t("analyticsDepth.comparison.ordersDelta")}><span className={deltaColor(deltas.ordersPct)}>{deltas.ordersPct > 0 ? "+" : ""}{deltas.ordersPct.toFixed(1)}%</span></Stat>
            <Stat label={t("analyticsDepth.comparison.aovDelta")}><span className={deltaColor(deltas.avgOrderValuePct)}>{deltas.avgOrderValuePct > 0 ? "+" : ""}{deltas.avgOrderValuePct.toFixed(1)}%</span></Stat>
            <Stat label={t("analyticsDepth.comparison.coversDelta")}><span className={deltaColor(deltas.coversPct)}>{deltas.coversPct > 0 ? "+" : ""}{deltas.coversPct.toFixed(1)}%</span></Stat>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** AI-02: Night forecast / projection. */
export function ForecastTab() {
  const t = useTranslations("shared");
  const data = useAnalytics("getNightForecast", () => analyticsService.getNightForecast());
  if (!data) return <Skeleton className="h-64 rounded-xl" />;
  const progressPct = data.hoursTotal > 0 ? (data.hoursElapsed / data.hoursTotal) * 100 : 0;
  const deltaColor = data.variancePct >= 0 ? "text-emerald-400" : "text-rose-400";
  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label={t("analyticsDepth.forecast.currentRevenue")} value={formatMoney(data.current.revenue)} icon={CircleDollarSign} info={t("analyticsDepth.forecast.currentRevenueInfo")} />
        <MetricCard label={t("analyticsDepth.forecast.currentOrders")} value={String(data.current.orders)} icon={Receipt} />
        <MetricCard label={t("analyticsDepth.forecast.projectedRevenue")} value={formatMoney(data.projected.revenue)} icon={TrendingUp} info={t("analyticsDepth.forecast.projectedRevenueInfo")} featured />
        <MetricCard label={t("analyticsDepth.forecast.projectedOrders")} value={String(data.projected.orders)} icon={TrendingUp} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("analyticsDepth.forecast.nightProgress", { hoursElapsed: data.hoursElapsed, hoursTotal: data.hoursTotal })}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(progressPct, 100)}%` }} />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("analyticsDepth.forecast.pace", { pace: data.paceMultiplier.toFixed(2) })}</span>
            <span className={`font-medium ${deltaColor}`}>
              {data.variancePct > 0 ? "+" : ""}{data.variancePct.toFixed(1)}% {t("analyticsDepth.forecast.vsAvg")}
            </span>
          </div>
          {data.eventBoost && (
            <p className="text-xs text-muted-foreground">
              {t("analyticsDepth.forecast.eventBoost", { eventName: data.eventBoost.eventName, uplift: formatMoney(data.eventBoost.estimatedUpliftCents / 100) })}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** AI-03: Per-hour breakdown. */
export function PerHourTab() {
  const t = useTranslations("shared");
  const [from, to] = [isoDaysAgo(6), isoDaysAgo(0)];
  const data = useAnalytics("getPerHourAnalytics", () => analyticsService.getPerHourAnalytics(from, to));
  if (!data) return <Skeleton className="h-64 rounded-xl" />;
  return (
    <div className="space-y-6 pt-4">
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        {t("analyticsDepth.perHour.liveSnapshotNote")}
        <InfoTip text={t("analyticsDepth.perHour.liveSnapshotInfo")} />
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label={t("analyticsDepth.perHour.peakHour")} value={data.peakHour} icon={Clock} info={t("analyticsDepth.perHour.peakHourInfo")} />
        <MetricCard label={t("analyticsDepth.perHour.peakRevenue")} value={formatMoney(data.peakRevenue)} icon={CircleDollarSign} featured />
        <MetricCard label={t("analyticsDepth.perHour.peakOccupancy")} value={`${data.peakOccupancy}/${data.legalCapacity}`} icon={Users} info={t("analyticsDepth.perHour.peakOccupancyInfo", { pct: formatPct(data.peakOccupancy / data.legalCapacity) })} />
        <MetricCard label={t("analyticsDepth.perHour.legalCapacity")} value={String(data.legalCapacity)} icon={Gauge} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("analyticsDepth.perHour.revenueByHourTitle")}</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">{t("analyticsDepth.perHour.header.hour")}</th>
                  <th className="pb-2 pr-4 text-right font-medium">{t("analyticsDepth.perHour.header.revenue")}</th>
                  <th className="pb-2 pr-4 text-right font-medium">{t("analyticsDepth.perHour.header.orders")}</th>
                  <th className="pb-2 pr-4 text-right font-medium">{t("analyticsDepth.perHour.header.in")}</th>
                  <th className="pb-2 pr-4 text-right font-medium">{t("analyticsDepth.perHour.header.out")}</th>
                  <th className="pb-2 pr-4 text-right font-medium">{t("analyticsDepth.perHour.header.occupancy")}</th>
                </tr>
              </thead>
              <tbody>
                {data.buckets.map((b) => (
                  <tr key={b.hour} className="border-b last:border-0">
                    <td className="py-2 pr-4 flex items-center gap-2">
                      {b.peakFlag && <Clock className="size-3 text-amber-400" />}
                      {b.hour}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{formatMoney(b.revenue)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{b.orders}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-emerald-400">{b.admissions}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-rose-400">{b.exits}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{b.occupancy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** AI-04: Door-to-table conversion funnel. */
export function FunnelTab() {
  const t = useTranslations("shared");
  const [from, to] = [isoDaysAgo(6), isoDaysAgo(0)];
  const data = useAnalytics("getDoorToTableFunnel", () => analyticsService.getDoorToTableFunnel(from, to));
  if (!data) return <Skeleton className="h-64 rounded-xl" />;
  const { rates } = data;
  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label={t("analyticsDepth.funnel.admissions")} value={String(data.admissions)} icon={DoorOpen} info={t("analyticsDepth.funnel.admissionsInfo")} />
        <MetricCard label={t("analyticsDepth.funnel.sessions")} value={String(data.sessionsCreated)} icon={Users} info={t("analyticsDepth.funnel.sessionsInfo")} hint={t("analyticsDepth.funnel.sessionRate", { rate: formatPct(rates.sessionRate) })} />
        <MetricCard label={t("analyticsDepth.funnel.ordersPlaced")} value={String(data.ordersPlaced)} icon={Receipt} hint={t("analyticsDepth.funnel.orderRate", { rate: formatPct(rates.orderRate) })} />
        <MetricCard label={t("analyticsDepth.funnel.ordersDelivered")} value={String(data.ordersDelivered)} icon={Target} info={t("analyticsDepth.funnel.ordersDeliveredInfo")} hint={t("analyticsDepth.funnel.deliveryRate", { rate: formatPct(rates.deliveryRate) })} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("analyticsDepth.funnel.conversionFunnel")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {[
            { stepKey: "analyticsDepth.funnel.steps.admissions", value: data.admissions, rate: 1 },
            { stepKey: "analyticsDepth.funnel.steps.sessionsCreated", value: data.sessionsCreated, rate: rates.sessionRate },
            { stepKey: "analyticsDepth.funnel.steps.menusOpened", value: data.menusOpened, rate: rates.menuOpenRate },
            { stepKey: "analyticsDepth.funnel.steps.ordersPlaced", value: data.ordersPlaced, rate: rates.orderRate },
            { stepKey: "analyticsDepth.funnel.steps.ordersDelivered", value: data.ordersDelivered, rate: rates.deliveryRate },
          ].map((s) => (
            <HorizontalBar
              key={s.stepKey}
              left={<span>{t(s.stepKey)}</span>}
              right={<span className="text-xs text-muted-foreground">{s.value} ({formatPct(s.rate)})</span>}
              ratio={s.rate}
            />
          ))}
          <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
            <AlertTriangle className="size-3" />
            {t("analyticsDepth.funnel.biggestDrop", { step: data.biggestDropStep, pct: formatPct(data.biggestDropPct) })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** AI-05: Table-turn analytics. */
export function TableTurnTab() {
  const t = useTranslations("shared");
  const [from, to] = [isoDaysAgo(6), isoDaysAgo(0)];
  const data = useAnalytics("getTableTurnAnalytics", () => analyticsService.getTableTurnAnalytics(from, to));
  if (!data) return <Skeleton className="h-64 rounded-xl" />;
  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label={t("analyticsDepth.tableTurn.avgTurnsPerTable")} value={data.avgTurnsPerTable.toFixed(1)} icon={Table} info={t("analyticsDepth.tableTurn.avgTurnsPerTableInfo")} />
        <MetricCard label={t("analyticsDepth.tableTurn.avgOccupancy")} value={t("analyticsDepth.tableTurn.avgOccupancyValue", { minutes: data.avgOccupancyMinutes })} icon={Clock} info={t("analyticsDepth.tableTurn.avgOccupancyInfo")} />
        <MetricCard label={t("analyticsDepth.tableTurn.totalSeatings")} value={String(data.totalSeatings)} icon={Users} />
        <MetricCard label={t("analyticsDepth.tableTurn.fastestTurn")} value={t("analyticsDepth.tableTurn.fastestTurnValue", { minutes: data.fastestTurn.minutes })} icon={Timer} hint={data.fastestTurn.tableCode} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("analyticsDepth.tableTurn.perTableBreakdown")}</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">{t("analyticsDepth.tableTurn.header.table")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("analyticsDepth.tableTurn.header.zone")}</th>
                  <th className="pb-2 pr-4 text-right font-medium">{t("analyticsDepth.tableTurn.header.seatings")}</th>
                  <th className="pb-2 pr-4 text-right font-medium">{t("analyticsDepth.tableTurn.header.avgMin")}</th>
                  <th className="pb-2 pr-4 text-right font-medium">{t("analyticsDepth.tableTurn.header.occupancy")}</th>
                  <th className="pb-2 text-right font-medium">{t("analyticsDepth.tableTurn.header.revPerSeating")}</th>
                </tr>
              </thead>
              <tbody>
                {data.turns.map((t) => (
                  <tr key={t.tableId} className="border-b last:border-0">
                    <td className="py-2 pr-4">{t.tableCode}</td>
                    <td className="py-2 pr-4"><EntityChip type="zone-tables" id={t.zoneId} label={t.zoneName} /></td>
                    <td className="py-2 pr-4 text-right tabular-nums">{t.seatings}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{t.avgOccupancyMinutes}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{formatPct(t.occupancyRate)}</td>
                    <td className="py-2 text-right tabular-nums">{formatMoney(t.revenuePerSeating)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** AI-06: Order SLA / time-to-serve analytics. */
export function SlaTab() {
  const t = useTranslations("shared");
  const [from, to] = [isoDaysAgo(6), isoDaysAgo(0)];
  const data = useAnalytics("getOrderSlaAnalytics", () => analyticsService.getOrderSlaAnalytics(from, to));
  if (!data) return <Skeleton className="h-64 rounded-xl" />;
  const maxDist = Math.max(...data.distribution.map((d) => d.count));
  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label={t("analyticsDepth.sla.avgTotalTime")} value={t("analyticsDepth.sla.avgTotalTimeValue", { minutes: data.avgTotalMinutes })} icon={Timer} info={t("analyticsDepth.sla.avgTotalTimeInfo")} />
        <MetricCard label={t("analyticsDepth.sla.p50")} value={t("analyticsDepth.sla.p50Value", { minutes: data.p50Minutes })} icon={Gauge} info={t("analyticsDepth.sla.p50Info")} />
        <MetricCard label={t("analyticsDepth.sla.p95")} value={t("analyticsDepth.sla.p95Value", { minutes: data.p95Minutes })} icon={Gauge} info={t("analyticsDepth.sla.p95Info")} />
        <MetricCard label={t("analyticsDepth.sla.slaBreaches")} value={String(data.slaBreachCount)} icon={AlertTriangle} info={t("analyticsDepth.sla.slaBreachesInfo")} hint={t("analyticsDepth.sla.breachHint", { breachRate: formatPct(data.slaBreachRate), escalated: data.autoEscalationCount })} featured={data.slaBreachCount > 0} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("analyticsDepth.sla.distribution")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.distribution.map((d) => (
              <HorizontalBar key={d.label} left={<span>{d.label}</span>} right={<span className="tabular-nums">{d.count}</span>} ratio={d.count / maxDist} />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">{t("analyticsDepth.sla.byZone")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.byZone.map((z) => (
              <div key={z.zoneId} className="flex justify-between text-sm">
                <EntityChip type="zone-tables" id={z.zoneId} label={z.zoneName} />
                <span className="tabular-nums text-muted-foreground">{t("analyticsDepth.sla.zoneRow", { minutes: z.avgMinutes, count: z.count })}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("analyticsDepth.sla.byStaff")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {data.byStaff.map((s) => (
            <div key={s.staffId} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2"><span>{s.staffName}</span><RoleBadge role={s.role} className="px-1.5 py-0 text-[10px]" /></span>
              <span className="tabular-nums text-muted-foreground">{t("analyticsDepth.sla.staffRow", { minutes: s.avgMinutes, count: s.count })}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/** AI-07: Comp/void ratio monitoring. */
export function CompVoidTab() {
  const t = useTranslations("shared");
  const [from, to] = [isoDaysAgo(6), isoDaysAgo(0)];
  const data = useAnalytics("getCompVoidRatioAnalytics", () => analyticsService.getCompVoidRatioAnalytics(from, to));
  if (!data) return <Skeleton className="h-64 rounded-xl" />;
  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label={t("analyticsDepth.compVoid.compRateThreshold")} value={formatPct(data.compRateThreshold)} icon={Percent} info={t("analyticsDepth.compVoid.compRateThresholdInfo")} />
        <MetricCard label={t("analyticsDepth.compVoid.voidRateThreshold")} value={formatPct(data.voidRateThreshold)} icon={Percent} />
        <MetricCard label={t("analyticsDepth.compVoid.flaggedStaff")} value={String(data.flaggedCount)} icon={AlertTriangle} info={t("analyticsDepth.compVoid.flaggedStaffInfo")} featured={data.flaggedCount > 0} />
        <MetricCard label={t("analyticsDepth.compVoid.staffTracked")} value={String(data.entries.length)} icon={Users} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("analyticsDepth.compVoid.perStaffBreakdown")}</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">{t("analyticsDepth.compVoid.header.staff")}</th>
                  <th className="pb-2 pr-4 font-medium">{t("analyticsDepth.compVoid.header.role")}</th>
                  <th className="pb-2 pr-4 text-right font-medium">{t("analyticsDepth.compVoid.header.comps")}</th>
                  <th className="pb-2 pr-4 text-right font-medium">{t("analyticsDepth.compVoid.header.compDollars")}</th>
                  <th className="pb-2 pr-4 text-right font-medium">{t("analyticsDepth.compVoid.header.compRate")}</th>
                  <th className="pb-2 pr-4 text-right font-medium">{t("analyticsDepth.compVoid.header.voids")}</th>
                  <th className="pb-2 pr-4 text-right font-medium">{t("analyticsDepth.compVoid.header.voidDollars")}</th>
                  <th className="pb-2 text-right font-medium">{t("analyticsDepth.compVoid.header.voidRate")}</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((e) => (
                  <tr key={e.staffId} className={`border-b last:border-0 ${e.flagged ? "bg-amber-950/10" : ""}`}>
                    <td className="py-2 pr-4 flex items-center gap-1">
                      {e.flagged && <AlertTriangle className="size-3 text-amber-400" />}
                      {e.staffName}
                    </td>
                    <td className="py-2 pr-4"><RoleBadge role={e.role} className="px-1.5 py-0 text-[10px]" /></td>
                    <td className="py-2 pr-4 text-right tabular-nums">{e.compCount}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{formatMoney(e.compCents / 100)}</td>
                    <td className={`py-2 pr-4 text-right tabular-nums ${e.compRate > data.compRateThreshold ? "text-amber-400 font-medium" : ""}`}>{formatPct(e.compRate)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{e.voidCount}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{formatMoney(e.voidCents / 100)}</td>
                    <td className={`py-2 text-right tabular-nums ${e.voidRate > data.voidRateThreshold ? "text-amber-400 font-medium" : ""}`}>{formatPct(e.voidRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** AI-09: Promoter performance report. */
export function PromoterPerformanceTab() {
  const t = useTranslations("shared");
  const [from, to] = [isoDaysAgo(6), isoDaysAgo(0)];
  const data = useAnalytics("getPromoterPerformanceReport", () => analyticsService.getPromoterPerformanceReport(from, to));
  if (!data) return <Skeleton className="h-64 rounded-xl" />;
  const totalRev = data.reduce((s, p) => s + p.attributedRevenue, 0);
  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label={t("analyticsDepth.promoter.totalAttributedRev")} value={formatMoney(totalRev)} icon={CircleDollarSign} info={t("analyticsDepth.promoter.totalAttributedRevInfo")} />
        <MetricCard label={t("analyticsDepth.promoter.promotersTracked")} value={String(data.length)} icon={Megaphone} />
        <MetricCard label={t("analyticsDepth.promoter.avgShowUpRate")} value={formatPct(data.reduce((s, p) => s + p.showUpRate, 0) / data.length)} icon={UserCheck} />
        <MetricCard label={t("analyticsDepth.promoter.totalCommission")} value={formatMoney(data.reduce((s, p) => s + p.commissionCents, 0) / 100)} icon={CircleDollarSign} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("analyticsDepth.promoter.leaderboard")}</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">{t("analyticsDepth.promoter.header.promoter")}</th>
                  <th className="pb-2 pr-4 text-right font-medium">{t("analyticsDepth.promoter.header.created")}</th>
                  <th className="pb-2 pr-4 text-right font-medium">{t("analyticsDepth.promoter.header.confirmed")}</th>
                  <th className="pb-2 pr-4 text-right font-medium">{t("analyticsDepth.promoter.header.checkIns")}</th>
                  <th className="pb-2 pr-4 text-right font-medium">{t("analyticsDepth.promoter.header.showUp")}</th>
                  <th className="pb-2 pr-4 text-right font-medium">{t("analyticsDepth.promoter.header.fillRate")}</th>
                  <th className="pb-2 pr-4 text-right font-medium">{t("analyticsDepth.promoter.header.rev")}</th>
                  <th className="pb-2 pr-4 text-right font-medium">{t("analyticsDepth.promoter.header.commission")}</th>
                  <th className="pb-2 text-right font-medium">{t("analyticsDepth.promoter.header.guestList")}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.promoterId} className="border-b last:border-0">
                    <td className="py-2 pr-4">{p.promoterName}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{p.reservationsCreated}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{p.reservationsConfirmed}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{p.checkIns}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{formatPct(p.showUpRate)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{formatPct(p.fillRate)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{formatMoney(p.attributedRevenue)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{formatMoney(p.commissionCents / 100)}</td>
                    <td className="py-2 text-right tabular-nums">{p.guestListCount} ({formatPct(p.guestListConversion)})</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** AI-10: Security incident pattern report. */
export function IncidentPatternTab() {
  const t = useTranslations("shared");
  const [from, to] = [isoDaysAgo(6), isoDaysAgo(0)];
  const data = useAnalytics("getIncidentPatternReport", () => analyticsService.getIncidentPatternReport(from, to));
  if (!data) return <Skeleton className="h-64 rounded-xl" />;
  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label={t("analyticsDepth.incidentPattern.totalIncidents")} value={String(data.totalIncidents)} icon={Shield} />
        <MetricCard label={t("analyticsDepth.incidentPattern.hotspotZones")} value={String(data.hotspots.length)} icon={AlertTriangle} info={t("analyticsDepth.incidentPattern.hotspotZonesInfo")} />
        <MetricCard label={t("analyticsDepth.incidentPattern.highSeverity")} value={String(Math.round(data.byZone.reduce((s, z) => s + z.high, 0)))} icon={AlertTriangle} featured />
        <MetricCard label={t("analyticsDepth.incidentPattern.mediumSeverity")} value={String(Math.round(data.byZone.reduce((s, z) => s + z.medium, 0)))} icon={AlertTriangle} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("analyticsDepth.incidentPattern.byZone")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.byZone.map((z) => (
              <div key={z.zoneId} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <EntityChip type="zone-tables" id={z.zoneId} label={z.zoneName} />
                  <span className="tabular-nums text-muted-foreground">
                    <span className="text-emerald-400">{z.low}</span> / <span className="text-amber-400">{z.medium}</span> / <span className="text-rose-400">{z.high}</span> ({z.total})
                  </span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-emerald-500" style={{ width: `${(z.low / z.total) * 100}%` }} />
                  <div className="h-full bg-amber-500" style={{ width: `${(z.medium / z.total) * 100}%` }} />
                  <div className="h-full bg-rose-500" style={{ width: `${(z.high / z.total) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">{t("analyticsDepth.incidentPattern.byDayOfWeek")}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.byDayOfWeek.map((d) => (
              <div key={d.day} className="flex justify-between text-sm">
                <span>{d.dayName}</span>
                <span className="tabular-nums">{d.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      {data.hotspots.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">{t("analyticsDepth.incidentPattern.hotspots")}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.hotspots.map((h, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{h.zoneName} @ {h.hour}</span>
                  <span className="tabular-nums">{t("analyticsDepth.incidentPattern.incidentsCount", { count: h.count })}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** AI-11: Guest retention metrics. */
export function GuestRetentionTab() {
  const t = useTranslations("shared");
  const [from, to] = [isoDaysAgo(6), isoDaysAgo(0)];
  const data = useAnalytics("getGuestRetentionMetrics", () => analyticsService.getGuestRetentionMetrics(from, to));
  if (!data) return <Skeleton className="h-64 rounded-xl" />;
  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label={t("analyticsDepth.guestRetention.totalGuests")} value={String(data.totalGuests)} icon={Users} info={t("analyticsDepth.guestRetention.totalGuestsInfo")} />
        <MetricCard label={t("analyticsDepth.guestRetention.newGuests")} value={String(data.newGuests)} icon={UserCheck} info={t("analyticsDepth.guestRetention.newGuestsInfo")} />
        <MetricCard label={t("analyticsDepth.guestRetention.repeatRate")} value={formatPct(data.repeatRate)} icon={TrendingUp} info={t("analyticsDepth.guestRetention.repeatRateInfo")} />
        <MetricCard label={t("analyticsDepth.guestRetention.churnRate")} value={formatPct(data.churnRate)} icon={ArrowDown} info={t("analyticsDepth.guestRetention.churnRateInfo")} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("analyticsDepth.guestRetention.engagement")}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Stat label={t("analyticsDepth.guestRetention.avgVisitsPerGuest")}>{data.avgVisitsPerGuest.toFixed(1)}</Stat>
              <Stat label={t("analyticsDepth.guestRetention.powerUsers")} info={t("analyticsDepth.guestRetention.powerUsersInfo")}>{data.powerUsers}</Stat>
              <Stat label={t("analyticsDepth.guestRetention.vipRetention")} info={t("analyticsDepth.guestRetention.vipRetentionInfo")}>{formatPct(data.vipRetentionRate)}</Stat>
              <Stat label={t("analyticsDepth.guestRetention.avgDaysBetween")} info={t("analyticsDepth.guestRetention.avgDaysBetweenInfo")}>{t("analyticsDepth.guestRetention.avgDaysBetweenValue", { days: data.avgDaysBetweenVisits.toFixed(1) })}</Stat>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** AI-12: Bottle service utilization. */
export function BottleServiceTab() {
  const t = useTranslations("shared");
  const [from, to] = [isoDaysAgo(6), isoDaysAgo(0)];
  const data = useAnalytics("getBottleServiceAnalytics", () => analyticsService.getBottleServiceAnalytics(from, to));
  if (!data) return <Skeleton className="h-64 rounded-xl" />;
  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label={t("analyticsDepth.bottleService.bottleRevenue")} value={formatMoney(data.totalBottleRevenue)} icon={Wine} info={t("analyticsDepth.bottleService.bottleRevenueInfo")} />
        <MetricCard label={t("analyticsDepth.bottleService.bottlesSold")} value={String(data.totalBottlesSold)} icon={Beer} />
        <MetricCard label={t("analyticsDepth.bottleService.presentations")} value={String(data.totalPresentations)} icon={PartyPopper} info={t("analyticsDepth.bottleService.presentationsInfo")} />
        <MetricCard label={t("analyticsDepth.bottleService.peakHour")} value={data.peakHour} icon={Clock} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("analyticsDepth.bottleService.byBottle")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {data.entries.sort((a, b) => b.revenue - a.revenue).map((e) => (
            <div key={e.menuItemId} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span>{e.itemName}</span>
                  <span className="text-xs text-muted-foreground">({e.categoryName})</span>
                </span>
                <span className="tabular-nums font-medium">{formatMoney(e.revenue)}</span>
              </div>
              <div className="flex text-xs text-muted-foreground gap-4">
                <span>{t("analyticsDepth.bottleService.bottleRow", { bottlesSold: e.bottlesSold, presentations: e.presentations })}</span>
                <span>{t("analyticsDepth.bottleService.avgPerPres", { avgRevenue: formatMoney(e.avgRevenuePerPresentation) })}</span>
                <span>{t("analyticsDepth.bottleService.shareOfBottleRev", { share: formatPct(e.shareOfBottleRevenue) })}</span>
              </div>
              <div className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                {e.zoneBreakdown.map((z) => (
                  <span key={z.zoneId} className="rounded bg-muted px-1.5 py-0.5">
                    {z.zoneName}: {z.bottles} ({formatMoney(z.revenue)})
                  </span>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/** AI-13: Capacity utilization. */
export function CapacityUtilizationTab() {
  const t = useTranslations("shared");
  const [from, to] = [isoDaysAgo(6), isoDaysAgo(0)];
  const data = useAnalytics("getCapacityUtilizationAnalytics", () => analyticsService.getCapacityUtilizationAnalytics(from, to));
  if (!data) return <Skeleton className="h-64 rounded-xl" />;
  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label={t("analyticsDepth.capacity.peakOccupancy")} value={String(data.peakOccupancy)} icon={Users} hint={t("analyticsDepth.capacity.peakOccupancyHint", { legalCapacity: data.legalCapacity, utilizationPct: formatPct(data.peakUtilizationPct) })} featured />
        <MetricCard label={t("analyticsDepth.capacity.avgOccupancy")} value={String(Math.round(data.avgOccupancy))} icon={Gauge} />
        <MetricCard label={t("analyticsDepth.capacity.avgStay")} value={t("analyticsDepth.capacity.avgStayValue", { minutes: data.avgStayMinutes })} icon={Clock} info={t("analyticsDepth.capacity.avgStayInfo")} />
        <MetricCard label={t("analyticsDepth.capacity.totalEntries")} value={String(data.totalEntries)} icon={DoorOpen} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("analyticsDepth.capacity.hourlyOccupancy")}</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.buckets.map((b) => (
              <div key={b.hour} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{b.hour}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("analyticsDepth.capacity.occupancyRow", { occupancy: b.occupancy, utilizationPct: formatPct(b.utilizationPct), entries: b.entries, exits: b.exits })}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary/70" style={{ width: `${b.utilizationPct * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          {data.exceededLegalCapacity && (
            <div className="mt-3 flex items-center gap-2 text-sm text-rose-400">
              <AlertTriangle className="size-4" /> {t("analyticsDepth.capacity.legalCapacityExceeded")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** AI-14: Night summary — executive summary. */
export function NightSummaryTab() {
  const t = useTranslations("shared");
  const today = new Date().toISOString().slice(0, 10);
  const data = useAnalytics("getNightSummary", () => analyticsService.getNightSummary(today));
  if (!data) return <Skeleton className="h-64 rounded-xl" />;
  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label={t("analyticsDepth.nightSummary.totalRevenue")} value={formatMoney(data.revenue.total)} icon={CircleDollarSign} hint={t("analyticsDepth.nightSummary.revenueDelta", { delta: `${data.revenue.deltaVsAvgPct > 0 ? "+" : ""}${data.revenue.deltaVsAvgPct.toFixed(1)}` })} />
        <MetricCard label={t("analyticsDepth.nightSummary.totalOrders")} value={String(data.orders.total)} icon={Receipt} hint={t("analyticsDepth.nightSummary.aovHint", { aov: formatMoney(data.orders.avgValue) })} />
        <MetricCard label={t("analyticsDepth.nightSummary.covers")} value={String(data.covers.total)} icon={Users} hint={t("analyticsDepth.nightSummary.coversHint", { seated: data.covers.seated, noShows: data.covers.noShowCount })} />
        <MetricCard label={t("analyticsDepth.nightSummary.incidents")} value={String(data.incidents.total)} icon={Shield} hint={t("analyticsDepth.nightSummary.incidentsHint", { highSeverity: data.incidents.highSeverity })} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("analyticsDepth.nightSummary.executiveSummary", { date: data.businessDate })}</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">{data.executiveSummary}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("analyticsDepth.nightSummary.staffAndTopPerformer")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <Stat label={t("analyticsDepth.nightSummary.staffOnDuty")}>{data.staff.onDuty}</Stat>
          <Stat label={t("analyticsDepth.nightSummary.topPerformer")}>{data.staff.topPerformer} ({formatMoney(data.staff.topPerformerRevenue)})</Stat>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("analyticsDepth.nightSummary.actionItems")}</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {data.actionItems.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <ClipboardList className="size-4 mt-0.5 text-muted-foreground shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      {data.inventory.soldOutItems.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">{t("analyticsDepth.nightSummary.soldOut")}</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.inventory.soldOutItems.map((item, i) => (
                <span key={i} className="rounded bg-muted px-2 py-1 text-sm">{item}</span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
