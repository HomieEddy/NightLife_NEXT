"use client";

import { FeatureGate } from "@/components/shared/feature-gate";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, Boxes, CalendarCheck, CalendarRange, CircleDollarSign,
  Clock, HandHelping, Megaphone, PartyPopper, Receipt, Tag, Timer, Trophy, Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EntityChip } from "@/components/shared/entity-chip";
import { InfoTip } from "@/components/shared/info-tip";
import { MetricCard } from "@/components/shared/metric-card";
import { MockChart } from "@/components/shared/mock-chart";
import { PageHeader } from "@/components/shared/page-header";
import { RoleBadge } from "@/components/shared/role-badge";
import {
  aggregateWeekly, analyticsService, type HistoricalAnalytics,
} from "@/lib/services/analytics-service";
import { formatMoney, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";

const isoDaysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};

const PRESETS = [
  { id: "7", label: "Last 7 days", days: 7 },
  { id: "30", label: "Last 30 days", days: 30 },
  { id: "90", label: "Last 90 days", days: 90 },
] as const;

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

/** Labeled horizontal bar — `ratio` is 0..1 of the widest row. */
function BarRow({
  left,
  right,
  ratio,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  ratio: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-sm">
        {left}
        {right}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary"
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
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
  const [preset, setPreset] = useState<string>("7");
  const [from, setFrom] = useState(isoDaysAgo(6));
  const [to, setTo] = useState(isoDaysAgo(0));
  const [data, setData] = useState<HistoricalAnalytics | null>(null);

  const load = useCallback(async (fromISO: string, toISO: string) => {
    setData(null);
    setData(await analyticsService.getHistorical(fromISO, toISO));
  }, []);

  useEffect(() => {
    load(from, to);
  }, [from, to, load]);

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
        title="Analytics"
        description="Historical performance — tonight's live numbers live on the Dashboard."
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
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="range-from" className="text-xs text-muted-foreground">
              From
            </Label>
            <Input
              id="range-from"
              type="date"
              value={from}
              max={to}
              onChange={(e) => {
                setPreset("custom");
                setFrom(e.target.value);
              }}
              className="h-9 w-38"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="range-to" className="text-xs text-muted-foreground">
              To
            </Label>
            <Input
              id="range-to"
              type="date"
              value={to}
              min={from}
              max={isoDaysAgo(0)}
              onChange={(e) => {
                setPreset("custom");
                setTo(e.target.value);
              }}
              className="h-9 w-38"
            />
          </div>
          <CalendarRange className="mb-2 size-4 text-muted-foreground" />
        </div>
      </div>

      {data === null ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : (
        <Tabs defaultValue="sales">
          <TabsList className="!h-auto w-full flex-wrap gap-1 sm:!h-8 sm:w-fit sm:flex-nowrap sm:gap-0">
            <TabsTrigger value="sales">
              <CircleDollarSign className="size-3.5" /> Sales
            </TabsTrigger>
            <TabsTrigger value="staff">
              <Users className="size-3.5" /> Staff
            </TabsTrigger>
            <TabsTrigger value="inventory">
              <Boxes className="size-3.5" /> Inventory
            </TabsTrigger>
            <TabsTrigger value="sessions">
              <Users className="size-3.5" /> Sessions
            </TabsTrigger>
            <TabsTrigger value="reservations">
              <CalendarCheck className="size-3.5" /> Reservations
            </TabsTrigger>
            <TabsTrigger value="happy-hours">
              <Clock className="size-3.5" /> Happy Hours
            </TabsTrigger>
            <TabsTrigger value="events">
              <PartyPopper className="size-3.5" /> Events
            </TabsTrigger>
            <TabsTrigger value="promotions">
              <Tag className="size-3.5" /> Promotions
            </TabsTrigger>
            <TabsTrigger value="promoters">
              <Megaphone className="size-3.5" /> Promoters
            </TabsTrigger>
          </TabsList>

          {/* ---------- Sales ---------- */}
          <TabsContent value="sales" className="space-y-6 pt-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard
                label="Revenue"
                value={formatMoney(data.totalRevenue)}
                icon={CircleDollarSign}
                info="Total revenue from all delivered orders in this date range, before fees."
                hint={`${data.days} nights`}
              />
              <MetricCard label="Orders" value={String(data.totalOrders)} icon={Receipt} info="Total orders placed across all nights in this range." />
              <MetricCard label="Avg order" value={formatMoney(data.avgOrderValue)} icon={CircleDollarSign} info="Total revenue divided by total orders in the range." />
              <MetricCard
                label="Best night"
                value={formatMoney(data.bestNight.revenue)}
                icon={Trophy}
                info="Single night with the highest revenue in the range."
                hint={data.bestNight.label}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Revenue {data.days > 21 ? "by week" : "by night"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MockChart data={chartSeries} height={220} />
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Revenue by zone</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.revenueByZone.map((zone) => (
                    <BarRow
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
                  <CardTitle className="text-base">Top items</CardTitle>
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
                        <span className="text-xs text-muted-foreground">{item.count} sold</span>
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
                  <CardTitle className="text-base">Order funnel</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm lg:grid-cols-4">
                    <Stat label="Placed" info="Total orders placed by guests in this range.">{data.orderFunnel.placed}</Stat>
                    <Stat label="Delivered" info="Orders successfully delivered to the table.">{data.orderFunnel.delivered}</Stat>
                    <Stat label="Cancelled" info="Orders cancelled before delivery, shown with cancellation rate.">{data.orderFunnel.cancelled}{" "}
                        <span className="text-xs text-muted-foreground">({formatPct(data.orderFunnel.cancellationRate)})</span></Stat>
                    <Stat label="Service fee revenue" info="Revenue collected from service fees applied to orders.">{formatMoney(data.orderFunnel.serviceFeeRevenue)}</Stat>
                    <Stat label="Tip rate" info="Percentage of orders that included a tip.">{formatPct(data.orderFunnel.tipRate)}</Stat>
                    <Stat label="Avg tip" info="Average tip amount on orders that included a tip.">{formatMoney(data.orderFunnel.avgTip)}</Stat>
                    <Stat label="Gift orders" info="Orders sent as gifts to another table, with total gift revenue.">{data.orderFunnel.giftOrders}{" "}
                        <span className="text-xs text-muted-foreground">({formatMoney(data.orderFunnel.giftRevenue)})</span></Stat>
                    <Stat label="Modifier attach" info="Percentage of order items that included at least one modifier (e.g. extra shot, premium mixer).">{formatPct(data.orderFunnel.modifierAttachRate)}</Stat>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Comps, voids & discounts — live from tonight's tab ledger (plan 16) */}
            {data.adjustments && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Comps, voids & discounts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm lg:grid-cols-3">
                    <Stat label="Voids" info="Lines removed from revenue with stock returned to inventory.">
                      {data.adjustments.voidCount}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({formatMoney(data.adjustments.voidCents / 100)} · {formatPct(data.adjustments.voidRate)})
                      </span>
                    </Stat>
                    <Stat label="Comps" info="Lines waived as a house gift — inventory stays depleted.">
                      {data.adjustments.compCount}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({formatMoney(data.adjustments.compCents / 100)} · {formatPct(data.adjustments.compRate)})
                      </span>
                    </Stat>
                    <Stat label="Discounts" info="Revenue reduced by a negotiated delta.">
                      {data.adjustments.discountCount}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({formatMoney(data.adjustments.discountCents / 100)} · {formatPct(data.adjustments.discountRate)})
                      </span>
                    </Stat>
                  </div>
                  {data.adjustments.byReason.length > 0 && (
                    <div className="space-y-1 border-t pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">By reason</p>
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
          </TabsContent>

          {/* ---------- Staff ---------- */}
          <TabsContent value="staff" className="space-y-6 pt-4">
            {/* Order ETA cards */}
            {data.orderEta && (
              <div className="grid grid-cols-3 gap-3">
                <MetricCard
                  label="Avg accept wait"
                  value={`${data.orderEta.avgAcceptMinutes} min`}
                  icon={Timer}
                  info="Average time from order placed to a host accepting it."
                />
                <MetricCard
                  label="Avg prep & delivery"
                  value={`${data.orderEta.avgPrepMinutes} min`}
                  icon={Timer}
                  info="Average time from order accepted to delivered at the table."
                />
                <MetricCard
                  label="Avg total ETA"
                  value={`${data.orderEta.avgTotalMinutes} min`}
                  icon={Timer}
                  info="Average end-to-end time from order placed to delivered."
                  featured
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard
                label="Orders delivered"
                value={String(orderStaff.reduce((s, p) => s + p.ordersDelivered, 0))}
                icon={Receipt}
                info="Total orders delivered by bartenders and hosts in the range."
                hint={`${data.days} nights`}
              />
              <MetricCard
                label="Revenue served"
                value={formatMoney(orderStaff.reduce((s, p) => s + p.revenueServed, 0))}
                icon={CircleDollarSign}
                info="Total revenue from orders delivered by bartenders and hosts."
              />
              <MetricCard
                label="Fastest server"
                value={fastestServer?.name.split(" ")[0] ?? "—"}
                icon={Users}
                info="Bartender or host with the lowest average delivery time."
                hint={`${fastestServer?.avgDeliveryMinutes ?? 0} min avg`}
              />
              <MetricCard
                label="Top earner"
                value={topEarner?.name.split(" ")[0] ?? "—"}
                icon={Trophy}
                info="Bartender or host who served the highest total revenue."
                hint="By revenue served"
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Orders delivered per server</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {orderStaff
                  .slice()
                  .sort((a, b) => b.ordersDelivered - a.ordersDelivered)
                  .map((perf) => (
                    <BarRow
                      key={perf.staffId}
                      left={
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate">{perf.name}</span>
                          <RoleBadge role={perf.role} className="px-1.5 py-0 text-[10px]" />
                        </span>
                      }
                      right={
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {perf.ordersDelivered} orders · {perf.avgDeliveryMinutes} min avg ·{" "}
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
                <CardTitle className="text-base">Order fulfilment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Name</th>
                        <th className="pb-2 pr-4 font-medium">Role</th>
                        <th className="pb-2 pr-4 text-right font-medium">Accept wait</th>
                        <th className="pb-2 pr-4 text-right font-medium">Delivery</th>
                        <th className="pb-2 pr-4 text-right font-medium">Revenue</th>
                        <th className="pb-2 text-right font-medium">Orders/hr</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderStaff.map((p) => (
                        <tr key={p.staffId} className="border-b last:border-0">
                          <td className="py-2 pr-4">{p.name}</td>
                          <td className="py-2 pr-4"><RoleBadge role={p.role} className="px-1.5 py-0 text-[10px]" /></td>
                          <td className="py-2 pr-4 text-right tabular-nums">{p.avgAcceptMinutes ?? "—"} min</td>
                          <td className="py-2 pr-4 text-right tabular-nums">{p.avgDeliveryMinutes} min</td>
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
                    <HandHelping className="size-4 text-primary" /> Help fulfilment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="pb-2 pr-4 font-medium">Name</th>
                          <th className="pb-2 pr-4 font-medium">Role</th>
                          <th className="pb-2 pr-4 text-right font-medium">Help resolved</th>
                          <th className="pb-2 text-right font-medium">Avg help min</th>
                        </tr>
                      </thead>
                      <tbody>
                        {helpStaff.map((p) => (
                          <tr key={p.staffId} className="border-b last:border-0">
                            <td className="py-2 pr-4">{p.name}</td>
                            <td className="py-2 pr-4"><RoleBadge role={p.role} className="px-1.5 py-0 text-[10px]" /></td>
                            <td className="py-2 pr-4 text-right tabular-nums">{p.helpResolved ?? 0}</td>
                            <td className="py-2 text-right tabular-nums">{p.avgHelpMinutes ?? "—"} min</td>
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
                  Manage staff & schedule <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </TabsContent>

          {/* ---------- Inventory ---------- */}
          <TabsContent value="inventory" className="space-y-6 pt-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard
                label="Units sold"
                value={String(data.categoryDepletion.reduce((s, c) => s + c.unitsSold, 0))}
                icon={Boxes}
                info="Total inventory units sold across all categories in the range."
                hint={`${data.days} nights`}
              />
              <MetricCard
                label="Top category"
                value={
                  [...data.categoryDepletion].sort((a, b) => b.unitsSold - a.unitsSold)[0]
                    ?.categoryName ?? "—"
                }
                icon={Trophy}
                info="Menu category with the most units sold in the range."
              />
              <MetricCard
                label="Avg units / night"
                value={String(
                  Math.round(
                    data.categoryDepletion.reduce((s, c) => s + c.unitsSold, 0) / data.days,
                  ),
                )}
                icon={Receipt}
                info="Total units sold divided by the number of nights in the range."
              />
              <MetricCard
                label="In stock now"
                value={String(data.categoryDepletion.reduce((s, c) => s + c.unitsInStock, 0))}
                icon={Boxes}
                info="Current inventory on hand across all categories."
                hint="Live count"
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sold vs in stock by category</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.categoryDepletion.map((cat) => (
                  <div key={cat.categoryId} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <EntityChip type="menu-category" id={cat.categoryId} label={cat.categoryName} />
                      <span className="text-xs text-muted-foreground">
                        {cat.unitsSold} sold · {cat.unitsInStock} left
                        {cat.sellThrough != null && ` · ${formatPct(cat.sellThrough)} sell-through`}
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
                  <span className="mr-1 inline-block size-2 rounded-full bg-primary" /> Sold in range
                  <span className="ml-3 mr-1 inline-block size-2 rounded-full bg-primary/30" /> Remaining
                </p>
              </CardContent>
            </Card>

            {/* Deepened: inventory depth */}
            {data.inventoryDepth && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Inventory depth</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm lg:grid-cols-4">
                    <Stat label="Sold-out events / night" info="Average number of stock-out incidents per night in the range.">{data.inventoryDepth.soldOutEventsPerNight}</Stat>
                    <Stat label="Total sold-out minutes" info="Cumulative minutes items were unavailable before restock.">{data.inventoryDepth.totalSoldOutMinutes}</Stat>
                    <Stat label="Restock / sale ratio" info="Units restocked divided by units sold — above 100% means building stock.">{formatPct(data.inventoryDepth.restockSaleRatio)}</Stat>
                    <Stat label="Dead items" info="Stocked items with zero orders in the range — potential menu bloat.">{data.inventoryDepth.deadItems}</Stat>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/manager/inventory">
                  Open inventory <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </TabsContent>

          {/* ---------- Sessions ---------- */}
          <TabsContent value="sessions" className="space-y-6 pt-4">
            {data.sessions ? (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <MetricCard label="Sessions" value={String(data.sessions.totalSessions)} icon={Users} info="Total guest sessions (scan → close) across all nights." hint={`${data.days} nights`} />
                  <MetricCard label="Approval rate" value={formatPct(data.sessions.approvalRate)} icon={Users} info="Percentage of session join requests approved by the host." />
                  <MetricCard label="Avg duration" value={`${data.sessions.avgDurationMinutes} min`} icon={Clock} info="Average time from session approval to tab closure." />
                  <MetricCard label="Rev / session" value={formatMoney(data.sessions.revenuePerSession)} icon={CircleDollarSign} info="Total revenue divided by total sessions in the range." />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Session metrics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                        <Stat label="Denial rate" info="Percentage of session join requests denied by the host.">{formatPct(data.sessions.denialRate)}</Stat>
                        <Stat label="Avg approval wait" info="Average minutes guests waited for host approval after scanning.">{data.sessions.avgApprovalMinutes} min</Stat>
                        <Stat label="Avg party size" info="Average number of guests per approved session.">{data.sessions.avgPartySize}</Stat>
                        <Stat label="Rev / guest" info="Total revenue divided by total guests (sessions × party size).">{formatMoney(data.sessions.revenuePerGuest)}</Stat>
                        <Stat label="Avg closure time" info="Average minutes from last order to tab closure by staff.">{data.sessions.avgClosureMinutes} min</Stat>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Tab settlement</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        How staff recorded each closed tab — the app doesn&apos;t process payments.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {data.sessions.settlementMix.map((s) => (
                        <BarRow
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
              <p className="text-sm text-muted-foreground">No session data available for this range.</p>
            )}
          </TabsContent>

          {/* ---------- Reservations ---------- */}
          <TabsContent value="reservations" className="space-y-6 pt-4">
            {data.reservations ? (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <MetricCard label="Requested" value={String(data.reservations.requested)} icon={CalendarCheck} info="Total reservation requests received in the range." />
                  <MetricCard label="Seated" value={String(data.reservations.seated)} icon={CalendarCheck} info="Guests who checked in and were seated at their table." hint={`${formatPct(data.reservations.seatedRate)} of confirmed`} />
                  <MetricCard label="No-show rate" value={formatPct(data.reservations.noShowRate)} icon={Users} info="Percentage of confirmed reservations where the guest didn't arrive." hint="of confirmed" />
                  <MetricCard label="Total covers" value={String(data.reservations.totalCovers)} icon={Users} info="Sum of party sizes across all seated reservations." />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Reservation funnel</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                        <Stat label="Confirmed" info="Reservations approved by the venue.">{data.reservations.confirmed} <span className="text-xs text-muted-foreground">({formatPct(data.reservations.confirmRate)} of requested)</span></Stat>
                        <Stat label="Completed" info="Reservations where the guest arrived and the visit finished.">{data.reservations.completed}</Stat>
                        <Stat label="Cancelled" info="Reservations cancelled before the scheduled date.">{data.reservations.cancelled} <span className="text-xs text-muted-foreground">({formatPct(data.reservations.cancellationRate)} of requested)</span></Stat>
                        <Stat label="Avg lead time" info="Average days between booking and the reserved date.">{data.reservations.avgLeadDays} days</Stat>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Source split</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {data.reservations.sourceSplit.map((s) => (
                        <BarRow
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
                    <CardTitle className="text-base">Channel breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {data.reservations.channelSplit.map((c) => (
                      <BarRow
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
                    <CardTitle className="text-base">Party size distribution</CardTitle>
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
                      Manage reservations <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No reservation data available for this range.</p>
            )}
          </TabsContent>

          {/* ---------- Happy Hours ---------- */}
          <TabsContent value="happy-hours" className="space-y-6 pt-4">
            {data.happyHours ? (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <MetricCard label="HH orders" value={String(data.happyHours.totalHhOrders)} icon={Receipt} info="Orders placed during active happy hour windows in the range." />
                  <MetricCard label="HH revenue" value={formatMoney(data.happyHours.totalHhRevenue)} icon={CircleDollarSign} info="Revenue from happy hour orders (at discounted prices)." />
                  <MetricCard label="Discount given" value={formatMoney(data.happyHours.totalDiscountGiven)} icon={CircleDollarSign} info="Total discount amount applied by happy hour rules." />
                  <MetricCard label="Rules active" value={String(data.happyHours.rules.length)} icon={Clock} info="Number of distinct happy hour rules that were active during this range." />
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Per rule breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-2 pr-4 font-medium">Rule</th>
                            <th className="pb-2 pr-4 text-right font-medium">Orders</th>
                            <th className="pb-2 pr-4 text-right font-medium">Revenue</th>
                            <th className="pb-2 pr-4 text-right font-medium">Discount</th>
                            <th className="pb-2 text-right font-medium">Category uplift</th>
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
              <p className="text-sm text-muted-foreground">No happy hour data available for this range.</p>
            )}
          </TabsContent>

          {/* ---------- Events ---------- */}
          <TabsContent value="events" className="space-y-6 pt-4">
            {data.events && data.events.events.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <MetricCard label="Events" value={String(data.events.totalEvents)} icon={PartyPopper} info="Total scheduled events that occurred in this range." />
                  <MetricCard label="Avg utilization" value={formatPct(data.events.avgCapacityUtilization)} icon={Users} info="Average check-ins divided by event capacity across all events." />
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Per event breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-2 pr-4 font-medium">Event</th>
                            <th className="pb-2 pr-4 text-right font-medium">Invited</th>
                            <th className="pb-2 pr-4 text-right font-medium">Confirmed</th>
                            <th className="pb-2 pr-4 text-right font-medium">Checked in</th>
                            <th className="pb-2 pr-4 text-right font-medium">Utilization</th>
                            <th className="pb-2 pr-4 text-right font-medium">Event rev</th>
                            <th className="pb-2 text-right font-medium">Avg weekday rev</th>
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
                      Manage events <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No event data available for this range.</p>
            )}
          </TabsContent>

          {/* ---------- Promotions ---------- */}
          <TabsContent value="promotions" className="space-y-6 pt-4">
            {data.promotions && data.promotions.promotions.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <MetricCard label="Redemptions" value={String(data.promotions.totalRedemptions)} icon={Tag} info="Total promo code redemptions in the range." />
                  <MetricCard label="Discount cost" value={formatMoney(data.promotions.totalDiscountCost)} icon={CircleDollarSign} info="Total value of discounts applied via promo codes." />
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Per promotion breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-2 pr-4 font-medium">Code</th>
                            <th className="pb-2 pr-4 text-right font-medium">Redemptions</th>
                            <th className="pb-2 pr-4 text-right font-medium">Discount cost</th>
                            <th className="pb-2 pr-4 text-right font-medium">Attributed rev</th>
                            <th className="pb-2 pr-4 text-right font-medium">AOV with</th>
                            <th className="pb-2 text-right font-medium">AOV without</th>
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
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/manager/promotions">
                      Manage promotions <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No promotion data available for this range.</p>
            )}
          </TabsContent>

          {/* ---------- Promoters ---------- */}
          <TabsContent value="promoters" className="space-y-6 pt-4">
            {data.promoters && data.promoters.promoters.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <MetricCard
                    label="Total attributed"
                    value={formatMoney(data.promoters.totalAttributedRevenue)}
                    icon={CircleDollarSign}
                    info="Revenue from orders placed in sessions attributed to a promoter."
                    hint={`${data.days} nights`}
                  />
                  <MetricCard
                    label="Guests funneled"
                    value={String(data.promoters.totalGuestsFunneled)}
                    icon={Users}
                    info="Total guests who arrived through promoter-sourced reservations."
                  />
                  <MetricCard
                    label="Top promoter"
                    value={
                      [...data.promoters.promoters].sort((a, b) => b.attributedRevenue - a.attributedRevenue)[0]
                        ?.promoterName.split(" ")[0] ?? "—"
                    }
                    icon={Trophy}
                    info="Promoter with the highest attributed revenue in the range."
                    hint="By revenue"
                  />
                  <MetricCard
                    label="Avg show-up"
                    value={formatPct(
                      data.promoters.promoters.reduce((s, p) => s + p.showUpRate, 0) / data.promoters.promoters.length,
                    )}
                    icon={CalendarCheck}
                    info="Average show-up rate across all promoters (seated ÷ confirmed)."
                  />
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Promoter leaderboard</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {(() => {
                      const sorted = [...data.promoters!.promoters].sort((a, b) => b.attributedRevenue - a.attributedRevenue);
                      const maxRev = sorted[0]?.attributedRevenue ?? 1;
                      return sorted.map((p) => (
                        <BarRow
                          key={p.promoterId}
                          left={
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="truncate">{p.promoterName}</span>
                              <RoleBadge role="promoter" className="px-1.5 py-0 text-[10px]" />
                            </span>
                          }
                          right={
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {p.guestsFunneled} guests ·{" "}
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
                    <CardTitle className="text-base">Reservation funnel by promoter</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-2 pr-4 font-medium">Promoter</th>
                            <th className="pb-2 pr-4 text-right font-medium">Created</th>
                            <th className="pb-2 pr-4 text-right font-medium">Confirmed</th>
                            <th className="pb-2 pr-4 text-right font-medium">Seated</th>
                            <th className="pb-2 pr-4 text-right font-medium">Show-up</th>
                            <th className="pb-2 pr-4 text-right font-medium">Guests</th>
                            <th className="pb-2 pr-4 text-right font-medium">Revenue</th>
                            <th className="pb-2 text-right font-medium">Avg / guest</th>
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
              <p className="text-sm text-muted-foreground">No promoter data available for this range.</p>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
