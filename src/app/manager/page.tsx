"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Euro, Receipt, Table2, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricCard } from "@/components/shared/metric-card";
import { MockChart } from "@/components/shared/mock-chart";
import { OrderCard } from "@/components/shared/order-card";
import { PageHeader } from "@/components/shared/page-header";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { mockAnalyticsService } from "@/lib/mock-services/analytics-service";
import { mockOrdersService } from "@/lib/mock-services/orders-service";
import { mockVenueService } from "@/lib/mock-services/venue-service";
import { formatMoney } from "@/lib/format";
import type { AnalyticsSummary, Order } from "@/lib/types";

export default function ManagerDashboardPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [venueName, setVenueName] = useState("LUXE Noir");

  useEffect(() => {
    mockAnalyticsService.getSummary().then(setSummary);
    mockOrdersService.listOrders().then((all) => setOrders(all.slice(0, 4)));
    mockVenueService.getVenue().then((v) => setVenueName(v.name));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Tonight at ${venueName}`}
        description="Saturday · Doors 22:00 — live operations overview"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/manager/analytics">
              Full analytics <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        }
      />

      {summary === null ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            label="Revenue"
            value={formatMoney(summary.revenueTonight)}
            deltaPct={summary.revenueDeltaPct}
            icon={Euro}
          />
          <MetricCard
            label="Orders"
            value={String(summary.ordersTonight)}
            deltaPct={summary.ordersDeltaPct}
            icon={Receipt}
          />
          <MetricCard
            label="Avg order"
            value={formatMoney(summary.avgOrderValue)}
            deltaPct={summary.avgOrderDeltaPct}
            icon={Euro}
          />
          <MetricCard
            label="Active tables"
            value={`${summary.activeTables}/${summary.totalTables}`}
            icon={Table2}
            hint={`Avg fulfillment ${summary.avgFulfillmentMinutes} min`}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Revenue by hour</CardTitle>
          </CardHeader>
          <CardContent>
            {summary === null ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <MockChart data={summary.revenueByHour} />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Top sellers tonight</CardTitle>
          </CardHeader>
          <CardContent>
            {summary === null ? (
              <ListSkeleton rows={5} rowHeight="h-8" />
            ) : (
              <ul className="space-y-3">
                {summary.topItems.map((item, i) => (
                  <li key={item.name} className="flex items-center gap-3 text-sm">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/15 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.name}</span>
                    <span className="text-xs text-muted-foreground">{item.count}×</span>
                    <span className="font-medium tabular-nums">{formatMoney(item.revenue)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Recent orders</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/manager/orders">
              Open order feed <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
        {orders === null ? (
          <ListSkeleton rows={3} rowHeight="h-24" />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} compact />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
