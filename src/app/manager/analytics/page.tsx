"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, Boxes, CalendarRange, CircleDollarSign, Receipt, Trophy, Users,
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
  aggregateWeekly, mockAnalyticsService, type HistoricalAnalytics,
} from "@/lib/mock-services/analytics-service";
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

export default function ManagerAnalyticsPage() {
  const [preset, setPreset] = useState<string>("7");
  const [from, setFrom] = useState(isoDaysAgo(6));
  const [to, setTo] = useState(isoDaysAgo(0));
  const [data, setData] = useState<HistoricalAnalytics | null>(null);

  const load = useCallback(async (fromISO: string, toISO: string) => {
    setData(null);
    setData(await mockAnalyticsService.getHistorical(fromISO, toISO));
  }, []);

  useEffect(() => {
    load(from, to);
  }, [from, to, load]);

  function applyPreset(id: string, days: number) {
    setPreset(id);
    setFrom(isoDaysAgo(days - 1));
    setTo(isoDaysAgo(0));
  }

  // Weekly buckets keep long ranges readable; daily bars under ~3 weeks.
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
          <TabsList>
            <TabsTrigger value="sales">
              <CircleDollarSign className="size-3.5" /> Sales
            </TabsTrigger>
            <TabsTrigger value="staff">
              <Users className="size-3.5" /> Staff
            </TabsTrigger>
            <TabsTrigger value="inventory">
              <Boxes className="size-3.5" /> Inventory
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

            <div className="flex justify-end">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/manager/inventory">
                  Open inventory <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
