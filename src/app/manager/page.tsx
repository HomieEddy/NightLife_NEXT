"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CircleDollarSign, Receipt, Table2, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MetricCard } from "@/components/shared/metric-card";
import { MockChart } from "@/components/shared/mock-chart";
import { OrderCard } from "@/components/shared/order-card";
import { PageHeader } from "@/components/shared/page-header";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { PulseTab } from "@/components/manager/pulse-tab";
import { useAuth } from "@/context/auth-context";
import { mockAnalyticsService } from "@/lib/mock-services/analytics-service";
import { mockGuestsService } from "@/lib/mock-services/guests-service";
import { mockOrdersService } from "@/lib/mock-services/orders-service";
import { mockPulseService } from "@/lib/mock-services/pulse-service";
import { mockVenueService } from "@/lib/mock-services/venue-service";
import { computeAttentionItems } from "@/lib/pulse";
import { formatMoney } from "@/lib/format";
import type { AnalyticsSummary, AttentionItem, Order } from "@/lib/types";

const PULSE_POLL_MS = 8000;

export default function ManagerDashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [venue, setVenue] = useState({ name: "Velvet Montréal", currency: "CAD" });
  const [attentionItems, setAttentionItems] = useState<AttentionItem[] | null>(null);
  const [lastCallActive, setLastCallActive] = useState(false);

  useEffect(() => {
    mockAnalyticsService.getSummary().then(setSummary);
    mockOrdersService.listOrders().then((all) => setOrders(all.slice(0, 4)));
    mockVenueService.getVenue().then((v) => setVenue({ name: v.name, currency: v.currency }));
  }, []);

  const refreshPulse = useCallback(async () => {
    const [liveOrders, helpRequests, tables, zones, venue, lastCall] = await Promise.all([
      mockOrdersService.listOrders(),
      mockGuestsService.listHelpRequests(),
      mockVenueService.listTables(),
      mockVenueService.listZones(),
      mockVenueService.getVenue(),
      mockPulseService.getLastCallState(),
    ]);
    setAttentionItems(
      computeAttentionItems(
        liveOrders,
        helpRequests,
        tables,
        zones,
        venue.slaThresholds,
        lastCall.active,
        venue.lastCallAutoFlagTables,
      ),
    );
    setLastCallActive(lastCall.active);
  }, []);

  useEffect(() => {
    refreshPulse();
    const interval = setInterval(refreshPulse, PULSE_POLL_MS);
    return () => clearInterval(interval);
  }, [refreshPulse]);

  const managerName = user?.name ?? "Manager";

  async function sendBroadcast(message: string) {
    await mockPulseService.sendBroadcast(message, managerName);
    await refreshPulse();
  }

  async function toggleLastCall() {
    if (lastCallActive) await mockPulseService.endLastCall();
    else await mockPulseService.startLastCall(managerName);
    await refreshPulse();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Tonight at ${venue.name}`}
        description="Saturday · Doors 22:00 — live operations overview"
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/manager/analytics">
              Full analytics <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        }
      />

      <Tabs defaultValue="tonight">
        <TabsList>
          <TabsTrigger value="tonight">Tonight</TabsTrigger>
          <TabsTrigger value="pulse">
            Pulse
            {attentionItems !== null && attentionItems.length > 0 && (
              <Badge variant="outline" className="ml-1 px-1.5 py-0 text-[10px]">
                {attentionItems.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tonight" className="space-y-6 pt-4">
          <TonightTab summary={summary} orders={orders} currency={venue.currency} />
        </TabsContent>

        <TabsContent value="pulse" className="pt-4">
          <PulseTab
            items={attentionItems}
            lastCallActive={lastCallActive}
            onSendBroadcast={sendBroadcast}
            onToggleLastCall={toggleLastCall}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TonightTab({
  summary,
  orders,
  currency,
}: {
  summary: AnalyticsSummary | null;
  orders: Order[] | null;
  currency: string;
}) {
  return (
    <>
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
            value={formatMoney(summary.revenueTonight, currency)}
            deltaPct={summary.revenueDeltaPct}
            icon={CircleDollarSign}
          />
          <MetricCard
            label="Orders"
            value={String(summary.ordersTonight)}
            deltaPct={summary.ordersDeltaPct}
            icon={Receipt}
          />
          <MetricCard
            label="Avg order"
            value={formatMoney(summary.avgOrderValue, currency)}
            deltaPct={summary.avgOrderDeltaPct}
            icon={CircleDollarSign}
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
                    <span className="font-medium tabular-nums">{formatMoney(item.revenue, currency)}</span>
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
    </>
  );
}
