"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, Boxes, CalendarCheck, CalendarRange, CircleDollarSign,
  Clock, PartyPopper, Receipt, Tag, Trophy, Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EntityChip } from "@/components/shared/entity-chip";
import { MetricCard } from "@/components/shared/metric-card";
import { MockChart } from "@/components/shared/mock-chart";
import { PageHeader } from "@/components/shared/page-header";
import { RoleBadge } from "@/components/shared/role-badge";
import {
  aggregateWeekly, analyticsService, type HistoricalAnalytics,
} from "@/lib/services/analytics-service";
import { formatMoney } from "@/lib/format";
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

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export default function ManagerAnalyticsPage() {
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

  const zoneMax = data ? Math.max(...data.revenueByZone.map((z) => z.revenue)) : 1;
  const staffMax = data ? Math.max(...data.staffPerformance.map((s) => s.ordersDelivered)) : 1;
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
          <TabsList className="flex-wrap">
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
          </TabsList>

          {/* ---------- Sales ---------- */}
          <TabsContent value="sales" className="space-y-6 pt-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard
                label="Revenue"
                value={formatMoney(data.totalRevenue)}
                icon={CircleDollarSign}
                hint={`${data.days} nights`}
              />
              <MetricCard label="Orders" value={String(data.totalOrders)} icon={Receipt} />
              <MetricCard label="Avg order" value={formatMoney(data.avgOrderValue)} icon={CircleDollarSign} />
              <MetricCard
                label="Best night"
                value={formatMoney(data.bestNight.revenue)}
                icon={Trophy}
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
                    <div key={zone.zoneId} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <EntityChip type="zone-tables" id={zone.zoneId} label={zone.zoneName} />
                        <span className="font-medium tabular-nums">{formatMoney(zone.revenue)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary"
                          style={{ width: `${(zone.revenue / zoneMax) * 100}%` }}
                        />
                      </div>
                    </div>
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
                    <div>
                      <p className="text-muted-foreground">Placed</p>
                      <p className="text-lg font-semibold tabular-nums">{data.orderFunnel.placed}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Delivered</p>
                      <p className="text-lg font-semibold tabular-nums">{data.orderFunnel.delivered}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Cancelled</p>
                      <p className="text-lg font-semibold tabular-nums">
                        {data.orderFunnel.cancelled}{" "}
                        <span className="text-xs text-muted-foreground">({pct(data.orderFunnel.cancellationRate)})</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Service fee revenue</p>
                      <p className="text-lg font-semibold tabular-nums">{formatMoney(data.orderFunnel.serviceFeeRevenue)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Tip rate</p>
                      <p className="text-lg font-semibold tabular-nums">{pct(data.orderFunnel.tipRate)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Avg tip</p>
                      <p className="text-lg font-semibold tabular-nums">{formatMoney(data.orderFunnel.avgTip)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Gift orders</p>
                      <p className="text-lg font-semibold tabular-nums">
                        {data.orderFunnel.giftOrders}{" "}
                        <span className="text-xs text-muted-foreground">({formatMoney(data.orderFunnel.giftRevenue)})</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Modifier attach</p>
                      <p className="text-lg font-semibold tabular-nums">{pct(data.orderFunnel.modifierAttachRate)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ---------- Staff ---------- */}
          <TabsContent value="staff" className="space-y-6 pt-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard
                label="Orders delivered"
                value={String(data.staffPerformance.reduce((s, p) => s + p.ordersDelivered, 0))}
                icon={Receipt}
                hint={`${data.days} nights, all staff`}
              />
              <MetricCard
                label="Revenue served"
                value={formatMoney(data.staffPerformance.reduce((s, p) => s + p.revenueServed, 0))}
                icon={CircleDollarSign}
              />
              <MetricCard
                label="Fastest runner"
                value={
                  [...data.staffPerformance].sort(
                    (a, b) => a.avgDeliveryMinutes - b.avgDeliveryMinutes,
                  )[0]?.name.split(" ")[0] ?? "—"
                }
                icon={Users}
                hint={`${[...data.staffPerformance].sort((a, b) => a.avgDeliveryMinutes - b.avgDeliveryMinutes)[0]?.avgDeliveryMinutes ?? 0} min avg`}
              />
              <MetricCard
                label="Top earner"
                value={
                  [...data.staffPerformance].sort((a, b) => b.revenueServed - a.revenueServed)[0]
                    ?.name.split(" ")[0] ?? "—"
                }
                icon={Trophy}
                hint="By revenue served"
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Orders delivered per team member</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.staffPerformance
                  .slice()
                  .sort((a, b) => b.ordersDelivered - a.ordersDelivered)
                  .map((perf) => (
                    <div key={perf.staffId} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate">{perf.name}</span>
                          <RoleBadge role={perf.role} className="px-1.5 py-0 text-[10px]" />
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {perf.ordersDelivered} orders · {perf.avgDeliveryMinutes} min avg ·{" "}
                          <span className="font-medium text-foreground tabular-nums">
                            {formatMoney(perf.revenueServed)}
                          </span>
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary"
                          style={{ width: `${(perf.ordersDelivered / staffMax) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>

            {/* Deepened: claim wait, help requests, orders/shift-hour */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fulfilment breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Name</th>
                        <th className="pb-2 pr-4 font-medium">Role</th>
                        <th className="pb-2 pr-4 text-right font-medium">Claim wait</th>
                        <th className="pb-2 pr-4 text-right font-medium">Delivery</th>
                        <th className="pb-2 pr-4 text-right font-medium">Help resolved</th>
                        <th className="pb-2 pr-4 text-right font-medium">Avg help min</th>
                        <th className="pb-2 text-right font-medium">Orders/hr</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.staffPerformance.map((p) => (
                        <tr key={p.staffId} className="border-b last:border-0">
                          <td className="py-2 pr-4">{p.name}</td>
                          <td className="py-2 pr-4"><RoleBadge role={p.role} className="px-1.5 py-0 text-[10px]" /></td>
                          <td className="py-2 pr-4 text-right tabular-nums">{p.avgClaimMinutes ?? "—"} min</td>
                          <td className="py-2 pr-4 text-right tabular-nums">{p.avgDeliveryMinutes} min</td>
                          <td className="py-2 pr-4 text-right tabular-nums">{p.helpResolved ?? 0}</td>
                          <td className="py-2 pr-4 text-right tabular-nums">{p.avgHelpMinutes ?? "—"}</td>
                          <td className="py-2 text-right tabular-nums">{p.ordersPerShiftHour ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

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
                hint={`${data.days} nights`}
              />
              <MetricCard
                label="Top category"
                value={
                  [...data.categoryDepletion].sort((a, b) => b.unitsSold - a.unitsSold)[0]
                    ?.categoryName ?? "—"
                }
                icon={Trophy}
              />
              <MetricCard
                label="Avg units / night"
                value={String(
                  Math.round(
                    data.categoryDepletion.reduce((s, c) => s + c.unitsSold, 0) / data.days,
                  ),
                )}
                icon={Receipt}
              />
              <MetricCard
                label="In stock now"
                value={String(data.categoryDepletion.reduce((s, c) => s + c.unitsInStock, 0))}
                icon={Boxes}
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
                        {cat.sellThrough != null && ` · ${pct(cat.sellThrough)} sell-through`}
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
                    <div>
                      <p className="text-muted-foreground">Sold-out events / night</p>
                      <p className="text-lg font-semibold tabular-nums">{data.inventoryDepth.soldOutEventsPerNight}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total sold-out minutes</p>
                      <p className="text-lg font-semibold tabular-nums">{data.inventoryDepth.totalSoldOutMinutes}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Restock / sale ratio</p>
                      <p className="text-lg font-semibold tabular-nums">{pct(data.inventoryDepth.restockSaleRatio)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Dead items</p>
                      <p className="text-lg font-semibold tabular-nums">{data.inventoryDepth.deadItems}</p>
                    </div>
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
                  <MetricCard label="Sessions" value={String(data.sessions.totalSessions)} icon={Users} hint={`${data.days} nights`} />
                  <MetricCard label="Approval rate" value={pct(data.sessions.approvalRate)} icon={Users} />
                  <MetricCard label="Avg duration" value={`${data.sessions.avgDurationMinutes} min`} icon={Clock} />
                  <MetricCard label="Rev / session" value={formatMoney(data.sessions.revenuePerSession)} icon={CircleDollarSign} />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Session metrics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Denial rate</p>
                          <p className="text-lg font-semibold tabular-nums">{pct(data.sessions.denialRate)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Avg approval wait</p>
                          <p className="text-lg font-semibold tabular-nums">{data.sessions.avgApprovalMinutes} min</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Avg party size</p>
                          <p className="text-lg font-semibold tabular-nums">{data.sessions.avgPartySize}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Rev / guest</p>
                          <p className="text-lg font-semibold tabular-nums">{formatMoney(data.sessions.revenuePerGuest)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Avg closure time</p>
                          <p className="text-lg font-semibold tabular-nums">{data.sessions.avgClosureMinutes} min</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Settlement mix</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {data.sessions.settlementMix.map((s) => (
                        <div key={s.method} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="capitalize">{s.method}</span>
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {s.count} ({pct(s.pct)})
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary"
                              style={{ width: `${s.pct * 100}%` }}
                            />
                          </div>
                        </div>
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
                  <MetricCard label="Requested" value={String(data.reservations.requested)} icon={CalendarCheck} />
                  <MetricCard label="Seated" value={String(data.reservations.seated)} icon={CalendarCheck} hint={`${pct(data.reservations.seatedRate)} of confirmed`} />
                  <MetricCard label="No-show rate" value={pct(data.reservations.noShowRate)} icon={Users} hint="of confirmed" />
                  <MetricCard label="Total covers" value={String(data.reservations.totalCovers)} icon={Users} />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Reservation funnel</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Confirmed</p>
                          <p className="text-lg font-semibold tabular-nums">{data.reservations.confirmed} <span className="text-xs text-muted-foreground">({pct(data.reservations.confirmRate)} of requested)</span></p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Completed</p>
                          <p className="text-lg font-semibold tabular-nums">{data.reservations.completed}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Cancelled</p>
                          <p className="text-lg font-semibold tabular-nums">{data.reservations.cancelled} <span className="text-xs text-muted-foreground">({pct(data.reservations.cancellationRate)} of requested)</span></p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Avg lead time</p>
                          <p className="text-lg font-semibold tabular-nums">{data.reservations.avgLeadDays} days</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Source split</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {data.reservations.sourceSplit.map((s) => (
                        <div key={s.source} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="capitalize">{s.source}</span>
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {s.count} ({pct(s.pct)})
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary"
                              style={{ width: `${s.pct * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>

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
                  <MetricCard label="HH orders" value={String(data.happyHours.totalHhOrders)} icon={Receipt} />
                  <MetricCard label="HH revenue" value={formatMoney(data.happyHours.totalHhRevenue)} icon={CircleDollarSign} />
                  <MetricCard label="Discount given" value={formatMoney(data.happyHours.totalDiscountGiven)} icon={CircleDollarSign} />
                  <MetricCard label="Rules active" value={String(data.happyHours.rules.length)} icon={Clock} />
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
                              <td className="py-2 text-right tabular-nums">{pct(r.categoryUpliftPct)}</td>
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
                  <MetricCard label="Events" value={String(data.events.totalEvents)} icon={PartyPopper} />
                  <MetricCard label="Avg utilization" value={pct(data.events.avgCapacityUtilization)} icon={Users} />
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
                              <td className="py-2 pr-4 text-right tabular-nums">{pct(e.capacityUtilization)}</td>
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
                  <MetricCard label="Redemptions" value={String(data.promotions.totalRedemptions)} icon={Tag} />
                  <MetricCard label="Discount cost" value={formatMoney(data.promotions.totalDiscountCost)} icon={CircleDollarSign} />
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
        </Tabs>
      )}
    </div>
  );
}
