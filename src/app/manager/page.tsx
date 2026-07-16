"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, CalendarCheck, CircleDollarSign, Clock, PartyPopper, Receipt, Table2,
  Tag, Timer, Users,
} from "lucide-react";
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
import { analyticsService } from "@/lib/services/analytics-service";
import { guestsService } from "@/lib/services/guests-service";
import { ordersService } from "@/lib/services/orders-service";
import { pulseService } from "@/lib/services/pulse-service";
import { venueService } from "@/lib/services/venue-service";
import { computeAttentionItems } from "@/lib/pulse";
import { useLiveEvents } from "@/lib/use-live-events";
import { formatMoney } from "@/lib/format";
import type { AnalyticsSummary, AttentionItem, Order } from "@/lib/types";

export default function ManagerDashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [venue, setVenue] = useState({ name: "Velvet Montréal", currency: "CAD" });
  const [attentionItems, setAttentionItems] = useState<AttentionItem[] | null>(null);
  const [lastCallActive, setLastCallActive] = useState(false);

  useEffect(() => {
    analyticsService.getSummary().then(setSummary);
    ordersService.listOrders().then((all) => setOrders(all.slice(0, 4)));
    venueService.getVenue().then((v) => setVenue({ name: v.name, currency: v.currency }));
  }, []);

  const refreshPulse = useCallback(async () => {
    const [liveOrders, helpRequests, tables, zones, venue, lastCall] = await Promise.all([
      ordersService.listOrders(),
      guestsService.listHelpRequests(),
      venueService.listTables(),
      venueService.listZones(),
      venueService.getVenue(),
      pulseService.getLastCallState(),
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

  const refreshPulseRef = useRef(refreshPulse);
  refreshPulseRef.current = refreshPulse;

  useEffect(() => { refreshPulse(); }, [refreshPulse]);

  useLiveEvents({
    scope: "manager",
    onEvent: () => refreshPulseRef.current(),
    fallbackMs: 8000,
    fallbackRefresh: () => refreshPulseRef.current(),
  });

  const managerName = user?.name ?? "Manager";

  async function sendBroadcast(message: string) {
    await pulseService.sendBroadcast(message, managerName);
    await refreshPulse();
  }

  async function toggleLastCall() {
    if (lastCallActive) await pulseService.endLastCall();
    else await pulseService.startLastCall(managerName);
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
          <TabsTrigger value="snapshot">Snapshot</TabsTrigger>
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

        <TabsContent value="snapshot" className="space-y-6 pt-4">
          <SnapshotTab summary={summary} currency={venue.currency} />
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

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
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

function SnapshotTab({
  summary,
  currency,
}: {
  summary: AnalyticsSummary | null;
  currency: string;
}) {
  if (summary === null) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Sessions */}
      {summary.sessions && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="size-4 text-primary" /> Guest sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-muted-foreground">Sessions</p>
                <p className="text-lg font-semibold tabular-nums">{summary.sessions.totalSessions}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Approval</p>
                <p className="text-lg font-semibold tabular-nums">{pct(summary.sessions.approvalRate)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Avg duration</p>
                <p className="text-lg font-semibold tabular-nums">{summary.sessions.avgDurationMinutes} min</p>
              </div>
              <div>
                <p className="text-muted-foreground">Party size</p>
                <p className="text-lg font-semibold tabular-nums">{summary.sessions.avgPartySize}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Rev / session</p>
                <p className="text-lg font-semibold tabular-nums">{formatMoney(summary.sessions.revenuePerSession, currency)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Rev / guest</p>
                <p className="text-lg font-semibold tabular-nums">{formatMoney(summary.sessions.revenuePerGuest, currency)}</p>
              </div>
            </div>
            <div className="mt-3 flex gap-3 text-xs text-muted-foreground">
              {summary.sessions.settlementMix.map((s) => (
                <span key={s.method} className="capitalize">{s.method} {pct(s.pct)}</span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Order funnel */}
      {summary.orderFunnel && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Receipt className="size-4 text-primary" /> Order funnel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-muted-foreground">Placed</p>
                <p className="text-lg font-semibold tabular-nums">{summary.orderFunnel.placed}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Delivered</p>
                <p className="text-lg font-semibold tabular-nums">{summary.orderFunnel.delivered}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Cancelled</p>
                <p className="text-lg font-semibold tabular-nums">{summary.orderFunnel.cancelled} <span className="text-xs text-muted-foreground">({pct(summary.orderFunnel.cancellationRate)})</span></p>
              </div>
              <div>
                <p className="text-muted-foreground">Tip rate</p>
                <p className="text-lg font-semibold tabular-nums">{pct(summary.orderFunnel.tipRate)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Fee revenue</p>
                <p className="text-lg font-semibold tabular-nums">{formatMoney(summary.orderFunnel.serviceFeeRevenue, currency)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Gift orders</p>
                <p className="text-lg font-semibold tabular-nums">{summary.orderFunnel.giftOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reservations */}
      {summary.reservations && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CalendarCheck className="size-4 text-primary" /> Reservations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-muted-foreground">Requested</p>
                <p className="text-lg font-semibold tabular-nums">{summary.reservations.requested}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Seated</p>
                <p className="text-lg font-semibold tabular-nums">{summary.reservations.seated} <span className="text-xs text-muted-foreground">({pct(summary.reservations.seatedRate)})</span></p>
              </div>
              <div>
                <p className="text-muted-foreground">No-shows</p>
                <p className="text-lg font-semibold tabular-nums">{pct(summary.reservations.noShowRate)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Covers</p>
                <p className="text-lg font-semibold tabular-nums">{summary.reservations.totalCovers}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Cancelled</p>
                <p className="text-lg font-semibold tabular-nums">{summary.reservations.cancelled} <span className="text-xs text-muted-foreground">({pct(summary.reservations.cancellationRate)})</span></p>
              </div>
              <div>
                <p className="text-muted-foreground">Avg lead</p>
                <p className="text-lg font-semibold tabular-nums">{summary.reservations.avgLeadDays} days</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Happy hours */}
      {summary.happyHours && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="size-4 text-primary" /> Happy hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-muted-foreground">HH orders</p>
                <p className="text-lg font-semibold tabular-nums">{summary.happyHours.totalHhOrders}</p>
              </div>
              <div>
                <p className="text-muted-foreground">HH revenue</p>
                <p className="text-lg font-semibold tabular-nums">{formatMoney(summary.happyHours.totalHhRevenue, currency)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Discount given</p>
                <p className="text-lg font-semibold tabular-nums">{formatMoney(summary.happyHours.totalDiscountGiven, currency)}</p>
              </div>
            </div>
            {summary.happyHours.rules.length > 0 && (
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                {summary.happyHours.rules.map((r) => (
                  <div key={r.ruleId} className="flex justify-between">
                    <span>{r.ruleName}</span>
                    <span className="tabular-nums">{r.orders} orders · {formatMoney(r.revenue, currency)} · +{pct(r.categoryUpliftPct)} uplift</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Events */}
      {summary.events && summary.events.events.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <PartyPopper className="size-4 text-primary" /> Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-muted-foreground">Events tonight</p>
                <p className="text-lg font-semibold tabular-nums">{summary.events.totalEvents}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Avg utilization</p>
                <p className="text-lg font-semibold tabular-nums">{pct(summary.events.avgCapacityUtilization)}</p>
              </div>
            </div>
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              {summary.events.events.map((e) => (
                <div key={e.eventId} className="flex justify-between">
                  <span>{e.eventName}</span>
                  <span className="tabular-nums">{e.checkedIn} in · {pct(e.capacityUtilization)} cap · {formatMoney(e.eventRevenue, currency)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Promotions */}
      {summary.promotions && summary.promotions.promotions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Tag className="size-4 text-primary" /> Promotions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-muted-foreground">Redemptions</p>
                <p className="text-lg font-semibold tabular-nums">{summary.promotions.totalRedemptions}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Discount cost</p>
                <p className="text-lg font-semibold tabular-nums">{formatMoney(summary.promotions.totalDiscountCost, currency)}</p>
              </div>
            </div>
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              {summary.promotions.promotions.map((p) => (
                <div key={p.promotionId} className="flex justify-between">
                  <span>{p.code}</span>
                  <span className="tabular-nums">{p.redemptions}× · {formatMoney(p.discountCost, currency)} off · AOV {formatMoney(p.aovWithPromo, currency)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Staff depth */}
      {summary.staffPerformance.length > 0 && summary.staffPerformance[0].avgClaimMinutes != null && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Timer className="size-4 text-primary" /> Staff fulfilment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-muted-foreground">Avg claim wait</p>
                <p className="text-lg font-semibold tabular-nums">
                  {(summary.staffPerformance.reduce((s, p) => s + (p.avgClaimMinutes ?? 0), 0) / summary.staffPerformance.length).toFixed(1)} min
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Help resolved</p>
                <p className="text-lg font-semibold tabular-nums">
                  {summary.staffPerformance.reduce((s, p) => s + (p.helpResolved ?? 0), 0)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Avg help time</p>
                <p className="text-lg font-semibold tabular-nums">
                  {(summary.staffPerformance.reduce((s, p) => s + (p.avgHelpMinutes ?? 0), 0) / summary.staffPerformance.length).toFixed(1)} min
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inventory depth */}
      {summary.inventoryDepth && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Receipt className="size-4 text-primary" /> Inventory depth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-muted-foreground">Sold-out events</p>
                <p className="text-lg font-semibold tabular-nums">{summary.inventoryDepth.soldOutEventsPerNight}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Sold-out min</p>
                <p className="text-lg font-semibold tabular-nums">{summary.inventoryDepth.totalSoldOutMinutes}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Dead items</p>
                <p className="text-lg font-semibold tabular-nums">{summary.inventoryDepth.deadItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
