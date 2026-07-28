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
import { InfoTip } from "@/components/shared/info-tip";
import { MetricCard } from "@/components/shared/metric-card";
import { MockChart } from "@/components/shared/mock-chart";
import { OrderCard } from "@/components/shared/order-card";
import { PageHeader } from "@/components/shared/page-header";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { PulseTab } from "@/components/manager/pulse-tab";
import { useAuth } from "@/context/auth-context";
import { analyticsService } from "@/features/analytics/analytics-service";
import { doorService } from "@/features/door/services";
import { guestsService } from "@/features/guests/services";
import { incidentService } from "@/features/safety/services";
import { ordersService } from "@/features/ordering/services";
import { pulseService } from "@/features/realtime/pulse-service";
import { venueService } from "@/features/venue/services";
import { waitlistService } from "@/features/door/waitlist-service";
import { computeAttentionItems } from "@/lib/pulse";
import { useLiveEvents } from "@/lib/use-live-events";
import { formatMoney, formatPct } from "@/features/shared/format";
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
    const [liveOrders, helpRequests, tables, zones, venue, lastCall, sessions, adjustments, occupancy, waitlistEntries, openIncidents] = await Promise.all([
      ordersService.listOrders(),
      guestsService.listHelpRequests(),
      venueService.listTables(),
      venueService.listZones(),
      venueService.getVenue(),
      pulseService.getLastCallState(),
      guestsService.listSessions("approved"),
      ordersService.listAllAdjustments(),
      doorService.getOccupancy(),
      waitlistService.listEntries("waiting"),
      incidentService.listIncidents({ status: "open" }),
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
        sessions,
        adjustments,
        venue.minimumSpendWarningRatio,
        {
          occupancy: occupancy.current,
          legalCapacity: occupancy.legalCapacity,
          occupancyWarnRatio: venue.occupancyWarnRatio,
          waitlistEntries,
          openIncidents,
        },
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
        description={`${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} · Doors 22:00 — live operations overview`}
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

/** Per-staff averages weighted by each staff's volume, not a mean of means. */
function weightedAvg<T>(rows: T[], value: (row: T) => number | undefined, weight: (row: T) => number) {
  let sum = 0;
  let totalWeight = 0;
  for (const row of rows) {
    const v = value(row);
    if (v == null) continue;
    const w = weight(row);
    sum += v * w;
    totalWeight += w;
  }
  return totalWeight > 0 ? sum / totalWeight : 0;
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
            info="Total revenue from all delivered orders tonight, before fees."
            featured
          />
          <MetricCard
            label="Orders"
            value={String(summary.ordersTonight)}
            deltaPct={summary.ordersDeltaPct}
            icon={Receipt}
            info="Count of orders placed tonight across all tables."
          />
          <MetricCard
            label="Avg order"
            value={formatMoney(summary.avgOrderValue, currency)}
            deltaPct={summary.avgOrderDeltaPct}
            icon={CircleDollarSign}
            info="Tonight's revenue divided by number of orders."
          />
          <MetricCard
            label="Active tables"
            value={`${summary.activeTables}/${summary.totalTables}`}
            icon={Table2}
            info="Tables with an active guest session right now vs total configured tables."
            hint={`Avg fulfillment ${summary.avgFulfillmentMinutes} min`}
          />
        </div>
      )}

      {summary?.orderEta && (
        <div className="grid grid-cols-3 gap-3">
          <MetricCard
            label="Accept wait"
            value={`${summary.orderEta.avgAcceptMinutes} min`}
            icon={Timer}
            info="Average time from order placed to a host accepting it tonight."
          />
          <MetricCard
            label="Prep & delivery"
            value={`${summary.orderEta.avgPrepMinutes} min`}
            icon={Timer}
            info="Average time from order accepted to delivered at the table tonight."
          />
          <MetricCard
            label="Total ETA"
            value={`${summary.orderEta.avgTotalMinutes} min`}
            icon={Timer}
            info="Average end-to-end time from order placed to delivered tonight."
            featured
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
                <p className="text-muted-foreground flex items-center gap-1">Sessions <InfoTip text="Total guest table sessions tonight." /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.sessions.totalSessions}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">Approval <InfoTip text="Percentage of join requests approved by a host." /></p>
                <p className="text-lg font-semibold tabular-nums">{formatPct(summary.sessions.approvalRate)}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">Avg duration <InfoTip text="Average time from session start to tab closure." /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.sessions.avgDurationMinutes} min</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">Party size <InfoTip text="Average number of guests per session." /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.sessions.avgPartySize}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">Rev / session <InfoTip text="Total revenue divided by number of sessions." /></p>
                <p className="text-lg font-semibold tabular-nums">{formatMoney(summary.sessions.revenuePerSession, currency)}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">Rev / guest <InfoTip text="Total revenue divided by total guests across all sessions." /></p>
                <p className="text-lg font-semibold tabular-nums">{formatMoney(summary.sessions.revenuePerGuest, currency)}</p>
              </div>
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
                <p className="text-muted-foreground flex items-center gap-1">Placed <InfoTip text="Orders submitted by guests tonight." /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.orderFunnel.placed}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">Delivered <InfoTip text="Orders marked delivered by a runner." /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.orderFunnel.delivered}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">Cancelled <InfoTip text="Orders cancelled before delivery, shown with cancellation rate." /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.orderFunnel.cancelled} <span className="text-xs text-muted-foreground">({formatPct(summary.orderFunnel.cancellationRate)})</span></p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">Tip rate <InfoTip text="Percentage of orders that included a tip." /></p>
                <p className="text-lg font-semibold tabular-nums">{formatPct(summary.orderFunnel.tipRate)}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">Fee revenue <InfoTip text="Total service fees collected across all orders tonight." /></p>
                <p className="text-lg font-semibold tabular-nums">{formatMoney(summary.orderFunnel.serviceFeeRevenue, currency)}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">Gift orders <InfoTip text="Bottles sent to another table as a gift." /></p>
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
                <p className="text-muted-foreground flex items-center gap-1">Requested <InfoTip text="Total reservation requests received tonight." /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.reservations.requested}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">Seated <InfoTip text="Guests who checked in and were seated." /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.reservations.seated} <span className="text-xs text-muted-foreground">({formatPct(summary.reservations.seatedRate)})</span></p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">No-shows <InfoTip text="Confirmed reservations where the guest never arrived, as a percentage of confirmed." /></p>
                <p className="text-lg font-semibold tabular-nums">{formatPct(summary.reservations.noShowRate)}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">Covers <InfoTip text="Total guests across all seated reservations." /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.reservations.totalCovers}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">Cancelled <InfoTip text="Reservations cancelled before arrival, as a percentage of requested." /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.reservations.cancelled} <span className="text-xs text-muted-foreground">({formatPct(summary.reservations.cancellationRate)})</span></p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">Avg lead <InfoTip text="Average days between booking and the reservation date." /></p>
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
                <p className="text-muted-foreground flex items-center gap-1">HH orders <InfoTip text="Orders placed during active happy hour windows." /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.happyHours.totalHhOrders}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">HH revenue <InfoTip text="Revenue from orders placed during happy hour (at discounted prices)." /></p>
                <p className="text-lg font-semibold tabular-nums">{formatMoney(summary.happyHours.totalHhRevenue, currency)}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">Discount given <InfoTip text="Total discount amount applied by happy hour rules." /></p>
                <p className="text-lg font-semibold tabular-nums">{formatMoney(summary.happyHours.totalDiscountGiven, currency)}</p>
              </div>
            </div>
            {summary.happyHours.rules.length > 0 && (
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                {summary.happyHours.rules.map((r) => (
                  <div key={r.ruleId} className="flex justify-between">
                    <span>{r.ruleName}</span>
                    <span className="tabular-nums">{r.orders} orders · {formatMoney(r.revenue, currency)} · +{formatPct(r.categoryUpliftPct)} uplift</span>
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
                <p className="text-muted-foreground flex items-center gap-1">Events tonight <InfoTip text="Number of scheduled events running tonight." /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.events.totalEvents}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">Avg utilization <InfoTip text="Average check-in count divided by event capacity across tonight's events." /></p>
                <p className="text-lg font-semibold tabular-nums">{formatPct(summary.events.avgCapacityUtilization)}</p>
              </div>
            </div>
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              {summary.events.events.map((e) => (
                <div key={e.eventId} className="flex justify-between">
                  <span>{e.eventName}</span>
                  <span className="tabular-nums">{e.checkedIn} in · {formatPct(e.capacityUtilization)} cap · {formatMoney(e.eventRevenue, currency)}</span>
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
                <p className="text-muted-foreground flex items-center gap-1">Redemptions <InfoTip text="Total number of promo codes redeemed tonight." /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.promotions.totalRedemptions}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">Discount cost <InfoTip text="Total value of discounts applied via promo codes tonight." /></p>
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

      {/* Order ETA */}
      {summary.orderEta && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Timer className="size-4 text-primary" /> Order ETA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-muted-foreground flex items-center gap-1">Accept wait <InfoTip text="Average time from order placed to accepted by a host." /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.orderEta.avgAcceptMinutes} min</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">Prep & delivery <InfoTip text="Average time from accepted to delivered at the table." /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.orderEta.avgPrepMinutes} min</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">Total ETA <InfoTip text="End-to-end average from placed to delivered." /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.orderEta.avgTotalMinutes} min</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Help fulfilment — runners */}
      {summary.staffPerformance.some((p) => p.role === "runner" && (p.helpResolved ?? 0) > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="size-4 text-primary" /> Help fulfilment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-muted-foreground flex items-center gap-1">Help resolved <InfoTip text="Total guest help requests resolved by runners tonight." /></p>
                <p className="text-lg font-semibold tabular-nums">
                  {summary.staffPerformance.filter((p) => p.role === "runner").reduce((s, p) => s + (p.helpResolved ?? 0), 0)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">Avg help time <InfoTip text="Weighted average minutes to resolve a guest help request." /></p>
                <p className="text-lg font-semibold tabular-nums">
                  {weightedAvg(summary.staffPerformance.filter((p) => p.role === "runner"), (p) => p.avgHelpMinutes, (p) => p.helpResolved ?? 0).toFixed(1)} min
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
                <p className="text-muted-foreground flex items-center gap-1">Sold-out events <InfoTip text="Number of times an item went out of stock during tonight's service." /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.inventoryDepth.soldOutEventsPerNight}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">Sold-out min <InfoTip text="Total minutes items were unavailable before restock tonight." /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.inventoryDepth.totalSoldOutMinutes}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">Dead items <InfoTip text="Stocked items with zero orders tonight — potential menu bloat." /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.inventoryDepth.deadItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
