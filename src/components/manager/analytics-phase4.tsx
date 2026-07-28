"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle, ArrowDown, Beer, CircleDollarSign, Clock, ClipboardList, DoorOpen,
  Gauge, Megaphone, PartyPopper, Percent, Receipt, Shield,
  Table, Target, Timer, TrendingUp, UserCheck, Users, Wine,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EntityChip } from "@/components/shared/entity-chip";
import { InfoTip } from "@/components/shared/info-tip";
import { MetricCard } from "@/components/shared/metric-card";
import { RoleBadge } from "@/components/shared/role-badge";
import {
  analyticsService,
} from "@/lib/services/analytics-service";
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

function BarRow({
  left, right, ratio,
}: { left: React.ReactNode; right: React.ReactNode; ratio: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-sm">
        {left}{right}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary" style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}

const isoDaysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

// ---------- Each AI tab gets its own loader + render ----------

/** AI-01: Night-over-night comparison. */
export function ComparisonTab() {
  const [data, setData] = useState<NightComparison | null>(null);
  useEffect(() => { analyticsService.getNightComparison().then(setData); }, []);
  if (!data) return <Skeleton className="h-64 rounded-xl" />;
  const { current, reference, deltas, referenceLabel } = data;
  const deltaColor = (v: number) => v >= 0 ? "text-emerald-400" : "text-rose-400";
  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Revenue tonight" value={formatMoney(current.revenue)} icon={CircleDollarSign} info="Tonight's total revenue." />
        <MetricCard label="Orders tonight" value={String(current.orders)} icon={Receipt} info="Tonight's total orders." />
        <MetricCard label="Covers tonight" value={String(current.covers)} icon={Users} info="Guests seated tonight." />
        <MetricCard label="Avg order value" value={formatMoney(current.avgOrderValue)} icon={Target} info="Tonight's average order value." />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{referenceLabel}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm lg:grid-cols-4">
            <Stat label="Reference revenue">{formatMoney(reference.revenue)}</Stat>
            <Stat label="Reference orders" info={`${referenceLabel} total orders.`}>{reference.orders}</Stat>
            <Stat label="Reference covers">{reference.covers}</Stat>
            <Stat label="Reference AOV">{formatMoney(reference.avgOrderValue)}</Stat>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Deltas</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm lg:grid-cols-4">
            <Stat label="Revenue delta"><span className={deltaColor(deltas.revenuePct)}>{deltas.revenuePct > 0 ? "+" : ""}{formatPct(deltas.revenuePct / 100)}</span></Stat>
            <Stat label="Orders delta"><span className={deltaColor(deltas.ordersPct)}>{deltas.ordersPct > 0 ? "+" : ""}{formatPct(deltas.ordersPct / 100)}</span></Stat>
            <Stat label="AOV delta"><span className={deltaColor(deltas.avgOrderValuePct)}>{deltas.avgOrderValuePct > 0 ? "+" : ""}{formatPct(deltas.avgOrderValuePct / 100)}</span></Stat>
            <Stat label="Covers delta"><span className={deltaColor(deltas.coversPct)}>{deltas.coversPct > 0 ? "+" : ""}{formatPct(deltas.coversPct / 100)}</span></Stat>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** AI-02: Night forecast / projection. */
export function ForecastTab() {
  const [data, setData] = useState<NightForecast | null>(null);
  useEffect(() => { analyticsService.getNightForecast().then(setData); }, []);
  if (!data) return <Skeleton className="h-64 rounded-xl" />;
  const progressPct = data.hoursTotal > 0 ? (data.hoursElapsed / data.hoursTotal) * 100 : 0;
  const deltaColor = data.variancePct >= 0 ? "text-emerald-400" : "text-rose-400";
  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Current revenue" value={formatMoney(data.current.revenue)} icon={CircleDollarSign} info="Revenue so far tonight." />
        <MetricCard label="Current orders" value={String(data.current.orders)} icon={Receipt} />
        <MetricCard label="Projected revenue" value={formatMoney(data.projected.revenue)} icon={TrendingUp} info="End-of-night projection at current pace." featured />
        <MetricCard label="Projected orders" value={String(data.projected.orders)} icon={TrendingUp} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Night progress ({data.hoursElapsed}h / {data.hoursTotal}h)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(progressPct, 100)}%` }} />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Pace: {data.paceMultiplier.toFixed(2)}x</span>
            <span className={`font-medium ${deltaColor}`}>
              {data.variancePct > 0 ? "+" : ""}{(data.variancePct * 100).toFixed(1)}% vs avg
            </span>
          </div>
          {data.eventBoost && (
            <p className="text-xs text-muted-foreground">
              Event boost: {data.eventBoost.eventName} (+{formatMoney(data.eventBoost.estimatedUpliftCents / 100)} estimated uplift)
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** AI-03: Per-hour breakdown. */
export function PerHourTab() {
  const [data, setData] = useState<PerHourAnalytics | null>(null);
  const [from, to] = [isoDaysAgo(6), isoDaysAgo(0)];
  useEffect(() => { analyticsService.getPerHourAnalytics(from, to).then(setData); }, [from, to]);
  if (!data) return <Skeleton className="h-64 rounded-xl" />;
  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Peak hour" value={data.peakHour} icon={Clock} info="Hour with the highest revenue." />
        <MetricCard label="Peak revenue" value={formatMoney(data.peakRevenue)} icon={CircleDollarSign} featured />
        <MetricCard label="Peak occupancy" value={`${data.peakOccupancy}/${data.legalCapacity}`} icon={Users} info={`${formatPct(data.peakOccupancy / data.legalCapacity)} of legal capacity.`} />
        <MetricCard label="Legal capacity" value={String(data.legalCapacity)} icon={Gauge} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Revenue, orders & admissions by hour</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Hour</th>
                  <th className="pb-2 pr-4 text-right font-medium">Revenue</th>
                  <th className="pb-2 pr-4 text-right font-medium">Orders</th>
                  <th className="pb-2 pr-4 text-right font-medium">In</th>
                  <th className="pb-2 pr-4 text-right font-medium">Out</th>
                  <th className="pb-2 pr-4 text-right font-medium">Occupancy</th>
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
  const [data, setData] = useState<DoorToTableFunnel | null>(null);
  const [from, to] = [isoDaysAgo(6), isoDaysAgo(0)];
  useEffect(() => { analyticsService.getDoorToTableFunnel(from, to).then(setData); }, [from, to]);
  if (!data) return <Skeleton className="h-64 rounded-xl" />;
  const { rates } = data;
  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Admissions" value={String(data.admissions)} icon={DoorOpen} info="Guests who entered the venue." />
        <MetricCard label="Sessions" value={String(data.sessionsCreated)} icon={Users} info="Guests who scanned a QR code." hint={`${formatPct(rates.sessionRate)} of admissions`} />
        <MetricCard label="Orders placed" value={String(data.ordersPlaced)} icon={Receipt} hint={`${formatPct(rates.orderRate)} of admissions`} />
        <MetricCard label="Orders delivered" value={String(data.ordersDelivered)} icon={Target} info="Successfully fulfilled orders." hint={`${formatPct(rates.deliveryRate)} of admissions`} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Conversion funnel</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {[
            { step: "Admissions", value: data.admissions, rate: 1 },
            { step: "Sessions created", value: data.sessionsCreated, rate: rates.sessionRate },
            { step: "Menus opened", value: data.menusOpened, rate: rates.menuOpenRate },
            { step: "Orders placed", value: data.ordersPlaced, rate: rates.orderRate },
            { step: "Orders delivered", value: data.ordersDelivered, rate: rates.deliveryRate },
          ].map((s) => (
            <BarRow
              key={s.step}
              left={<span>{s.step}</span>}
              right={<span className="text-xs text-muted-foreground">{s.value} ({formatPct(s.rate)})</span>}
              ratio={s.rate}
            />
          ))}
          <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
            <AlertTriangle className="size-3" />
            Biggest drop: {data.biggestDropStep} ({formatPct(data.biggestDropPct)})
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** AI-05: Table-turn analytics. */
export function TableTurnTab() {
  const [data, setData] = useState<TableTurnAnalytics | null>(null);
  const [from, to] = [isoDaysAgo(6), isoDaysAgo(0)];
  useEffect(() => { analyticsService.getTableTurnAnalytics(from, to).then(setData); }, [from, to]);
  if (!data) return <Skeleton className="h-64 rounded-xl" />;
  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Avg turns/table" value={data.avgTurnsPerTable.toFixed(1)} icon={Table} info="Average seatings per table." />
        <MetricCard label="Avg occupancy" value={`${data.avgOccupancyMinutes} min`} icon={Clock} info="Average time a table was occupied per seating." />
        <MetricCard label="Total seatings" value={String(data.totalSeatings)} icon={Users} />
        <MetricCard label="Fastest turn" value={`${data.fastestTurn.minutes} min`} icon={Timer} hint={data.fastestTurn.tableCode} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Per-table breakdown</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Table</th>
                  <th className="pb-2 pr-4 font-medium">Zone</th>
                  <th className="pb-2 pr-4 text-right font-medium">Seatings</th>
                  <th className="pb-2 pr-4 text-right font-medium">Avg min</th>
                  <th className="pb-2 pr-4 text-right font-medium">Occupancy</th>
                  <th className="pb-2 text-right font-medium">Rev/seating</th>
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
  const [data, setData] = useState<OrderSlaAnalytics | null>(null);
  const [from, to] = [isoDaysAgo(6), isoDaysAgo(0)];
  useEffect(() => { analyticsService.getOrderSlaAnalytics(from, to).then(setData); }, [from, to]);
  if (!data) return <Skeleton className="h-64 rounded-xl" />;
  const maxDist = Math.max(...data.distribution.map((d) => d.count));
  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Avg total time" value={`${data.avgTotalMinutes} min`} icon={Timer} info="Average end-to-end from placement to delivery." />
        <MetricCard label="p50 (median)" value={`${data.p50Minutes} min`} icon={Gauge} info="50% of orders are delivered faster than this." />
        <MetricCard label="p95" value={`${data.p95Minutes} min`} icon={Gauge} info="95% of orders are delivered within this time." />
        <MetricCard label="SLA breaches" value={String(data.slaBreachCount)} icon={AlertTriangle} info="Orders exceeding the SLA threshold." hint={`${formatPct(data.slaBreachRate)} breach rate · ${data.autoEscalationCount} escalated`} featured={data.slaBreachCount > 0} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Distribution</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.distribution.map((d) => (
              <BarRow key={d.label} left={<span>{d.label}</span>} right={<span className="tabular-nums">{d.count}</span>} ratio={d.count / maxDist} />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">By zone</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.byZone.map((z) => (
              <div key={z.zoneId} className="flex justify-between text-sm">
                <EntityChip type="zone-tables" id={z.zoneId} label={z.zoneName} />
                <span className="tabular-nums text-muted-foreground">{z.avgMinutes} min ({z.count} orders)</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">By staff</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {data.byStaff.map((s) => (
            <div key={s.staffId} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2"><span>{s.staffName}</span><RoleBadge role={s.role} className="px-1.5 py-0 text-[10px]" /></span>
              <span className="tabular-nums text-muted-foreground">{s.avgMinutes} min ({s.count} orders)</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/** AI-07: Comp/void ratio monitoring. */
export function CompVoidTab() {
  const [data, setData] = useState<CompVoidRatioAnalytics | null>(null);
  const [from, to] = [isoDaysAgo(6), isoDaysAgo(0)];
  useEffect(() => { analyticsService.getCompVoidRatioAnalytics(from, to).then(setData); }, [from, to]);
  if (!data) return <Skeleton className="h-64 rounded-xl" />;
  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Comp rate threshold" value={formatPct(data.compRateThreshold)} icon={Percent} info="Comp rate above which a staff member is flagged." />
        <MetricCard label="Void rate threshold" value={formatPct(data.voidRateThreshold)} icon={Percent} />
        <MetricCard label="Flagged staff" value={String(data.flaggedCount)} icon={AlertTriangle} info="Staff exceeding either threshold." featured={data.flaggedCount > 0} />
        <MetricCard label="Staff tracked" value={String(data.entries.length)} icon={Users} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Per-staff breakdown</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Staff</th>
                  <th className="pb-2 pr-4 font-medium">Role</th>
                  <th className="pb-2 pr-4 text-right font-medium">Comps</th>
                  <th className="pb-2 pr-4 text-right font-medium">Comp $</th>
                  <th className="pb-2 pr-4 text-right font-medium">Comp rate</th>
                  <th className="pb-2 pr-4 text-right font-medium">Voids</th>
                  <th className="pb-2 pr-4 text-right font-medium">Void $</th>
                  <th className="pb-2 text-right font-medium">Void rate</th>
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
  const [data, setData] = useState<PromoterPerformanceReport[] | null>(null);
  const [from, to] = [isoDaysAgo(6), isoDaysAgo(0)];
  useEffect(() => { analyticsService.getPromoterPerformanceReport(from, to).then(setData); }, [from, to]);
  if (!data) return <Skeleton className="h-64 rounded-xl" />;
  const totalRev = data.reduce((s, p) => s + p.attributedRevenue, 0);
  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Total attributed rev" value={formatMoney(totalRev)} icon={CircleDollarSign} info="Revenue from promoter-sourced reservations." />
        <MetricCard label="Promoters tracked" value={String(data.length)} icon={Megaphone} />
        <MetricCard label="Avg show-up rate" value={formatPct(data.reduce((s, p) => s + p.showUpRate, 0) / data.length)} icon={UserCheck} />
        <MetricCard label="Total commission" value={formatMoney(data.reduce((s, p) => s + p.commissionCents, 0) / 100)} icon={CircleDollarSign} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Promoter leaderboard</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Promoter</th>
                  <th className="pb-2 pr-4 text-right font-medium">Created</th>
                  <th className="pb-2 pr-4 text-right font-medium">Confirmed</th>
                  <th className="pb-2 pr-4 text-right font-medium">Check-ins</th>
                  <th className="pb-2 pr-4 text-right font-medium">Show-up</th>
                  <th className="pb-2 pr-4 text-right font-medium">Fill rate</th>
                  <th className="pb-2 pr-4 text-right font-medium">Rev</th>
                  <th className="pb-2 pr-4 text-right font-medium">Commission</th>
                  <th className="pb-2 text-right font-medium">Guest list</th>
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
  const [data, setData] = useState<IncidentPatternReport | null>(null);
  const [from, to] = [isoDaysAgo(6), isoDaysAgo(0)];
  useEffect(() => { analyticsService.getIncidentPatternReport(from, to).then(setData); }, [from, to]);
  if (!data) return <Skeleton className="h-64 rounded-xl" />;
  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Total incidents" value={String(data.totalIncidents)} icon={Shield} />
        <MetricCard label="Hotspot zones" value={String(data.hotspots.length)} icon={AlertTriangle} info="Zone + hour combos with the most incidents." />
        <MetricCard label="High severity" value={String(data.byZone.reduce((s, z) => s + z.high, 0))} icon={AlertTriangle} featured />
        <MetricCard label="Medium severity" value={String(data.byZone.reduce((s, z) => s + z.medium, 0))} icon={AlertTriangle} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">By zone</CardTitle></CardHeader>
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
          <CardHeader><CardTitle className="text-base">By day of week</CardTitle></CardHeader>
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
          <CardHeader><CardTitle className="text-base">Hotspots</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.hotspots.map((h, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{h.zoneName} @ {h.hour}</span>
                  <span className="tabular-nums">{h.count} incidents</span>
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
  const [data, setData] = useState<GuestRetentionMetrics | null>(null);
  const [from, to] = [isoDaysAgo(6), isoDaysAgo(0)];
  useEffect(() => { analyticsService.getGuestRetentionMetrics(from, to).then(setData); }, [from, to]);
  if (!data) return <Skeleton className="h-64 rounded-xl" />;
  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Total guests" value={String(data.totalGuests)} icon={Users} info="Unique guests who visited in this range." />
        <MetricCard label="New guests" value={String(data.newGuests)} icon={UserCheck} info="First-time visitors in this range." />
        <MetricCard label="Repeat rate" value={formatPct(data.repeatRate)} icon={TrendingUp} info="Percentage of guests who visited more than once." />
        <MetricCard label="Churn rate" value={formatPct(data.churnRate)} icon={ArrowDown} info="Guests who visited last period but not this one." />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Engagement</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Stat label="Avg visits/guest">{data.avgVisitsPerGuest.toFixed(1)}</Stat>
              <Stat label="Power users" info="Guests with 3+ visits in this range.">{data.powerUsers}</Stat>
              <Stat label="VIP retention" info="Percentage of VIPs who returned this period.">{formatPct(data.vipRetentionRate)}</Stat>
              <Stat label="Avg days between" info="Average days between visits for returning guests.">{data.avgDaysBetweenVisits.toFixed(1)} days</Stat>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** AI-12: Bottle service utilization. */
export function BottleServiceTab() {
  const [data, setData] = useState<BottleServiceAnalytics | null>(null);
  const [from, to] = [isoDaysAgo(6), isoDaysAgo(0)];
  useEffect(() => { analyticsService.getBottleServiceAnalytics(from, to).then(setData); }, [from, to]);
  if (!data) return <Skeleton className="h-64 rounded-xl" />;
  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Bottle revenue" value={formatMoney(data.totalBottleRevenue)} icon={Wine} info="Total revenue from bottle service." />
        <MetricCard label="Bottles sold" value={String(data.totalBottlesSold)} icon={Beer} />
        <MetricCard label="Presentations" value={String(data.totalPresentations)} icon={PartyPopper} info="Sparkler/presentation events." />
        <MetricCard label="Peak hour" value={data.peakHour} icon={Clock} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">By bottle</CardTitle></CardHeader>
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
                <span>{e.bottlesSold} bottles · {e.presentations} presentations</span>
                <span>Avg {formatMoney(e.avgRevenuePerPresentation)}/pres</span>
                <span>{formatPct(e.shareOfBottleRevenue)} of bottle rev</span>
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
  const [data, setData] = useState<CapacityUtilizationAnalytics | null>(null);
  const [from, to] = [isoDaysAgo(6), isoDaysAgo(0)];
  useEffect(() => { analyticsService.getCapacityUtilizationAnalytics(from, to).then(setData); }, [from, to]);
  if (!data) return <Skeleton className="h-64 rounded-xl" />;
  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Peak occupancy" value={String(data.peakOccupancy)} icon={Users} hint={`of ${data.legalCapacity} · ${formatPct(data.peakUtilizationPct)}`} featured />
        <MetricCard label="Avg occupancy" value={String(Math.round(data.avgOccupancy))} icon={Gauge} />
        <MetricCard label="Avg stay" value={`${data.avgStayMinutes} min`} icon={Clock} info="Average time guests spent in the venue." />
        <MetricCard label="Total entries" value={String(data.totalEntries)} icon={DoorOpen} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Hourly occupancy</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.buckets.map((b) => (
              <div key={b.hour} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{b.hour}</span>
                  <span className="text-xs text-muted-foreground">
                    {b.occupancy} guests · {formatPct(b.utilizationPct)} · in {b.entries} / out {b.exits}
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
              <AlertTriangle className="size-4" /> Legal capacity was exceeded during this range.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** AI-14: Night summary — executive summary. */
export function NightSummaryTab() {
  const [data, setData] = useState<NightSummary | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  useEffect(() => { analyticsService.getNightSummary(today).then(setData); }, [today]);
  if (!data) return <Skeleton className="h-64 rounded-xl" />;
  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Total revenue" value={formatMoney(data.revenue.total)} icon={CircleDollarSign} hint={`${data.revenue.deltaVsAvgPct > 0 ? "+" : ""}${data.revenue.deltaVsAvgPct.toFixed(1)}% vs avg`} />
        <MetricCard label="Total orders" value={String(data.orders.total)} icon={Receipt} hint={`AOV ${formatMoney(data.orders.avgValue)}`} />
        <MetricCard label="Covers" value={String(data.covers.total)} icon={Users} hint={`${data.covers.seated} seated, ${data.covers.noShowCount} no-shows`} />
        <MetricCard label="Incidents" value={String(data.incidents.total)} icon={Shield} hint={`${data.incidents.highSeverity} high severity`} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Executive summary — {data.businessDate}</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">{data.executiveSummary}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Staff & top performer</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <Stat label="Staff on duty">{data.staff.onDuty}</Stat>
          <Stat label="Top performer">{data.staff.topPerformer} ({formatMoney(data.staff.topPerformerRevenue)})</Stat>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Action items</CardTitle></CardHeader>
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
          <CardHeader><CardTitle className="text-base">Sold out</CardTitle></CardHeader>
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
