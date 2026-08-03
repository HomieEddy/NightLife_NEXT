"use client";

import { useRef, useCallback } from "react";
import Link from "next/link";
import {
  ArrowRight, CalendarCheck, CircleDollarSign, Clock, PartyPopper, Receipt, Table2,
  Tag, Timer, Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InfoTip } from "@/components/shared/info-tip";
import { MetricCard } from "@/components/shared/metric-card";
import { RevenueChart } from "@/components/shared/revenue-chart";
import { OrderCard } from "@/components/shared/order-card";
import { PageHeader } from "@/components/shared/page-header";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { QueryErrorState } from "@/components/shared/query-error-state";
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
import { analyticsKeys } from "@/features/analytics/query-keys";
import { ordersKeys } from "@/features/ordering/query-keys";
import { venueKeys } from "@/features/venue/query-keys";
import type { AnalyticsSummary, AttentionItem, Order } from "@/lib/types";

export default function ManagerDashboardPage() {
  const t = useTranslations("manager.dashboard");
  const { user } = useAuth();
  const venueId = user?.venueId ?? "";
  const queryClient = useQueryClient();

  const { data: summary, isError: summaryError } = useQuery({
    queryKey: analyticsKeys.summary(venueId),
    queryFn: () => analyticsService.getSummary(),
    enabled: !!venueId,
  });

  const { data: orders } = useQuery({
    queryKey: ordersKeys.all(venueId),
    queryFn: () => ordersService.listOrders(),
    enabled: !!venueId,
  });

  const { data: venue, isError: venueError } = useQuery({
    queryKey: venueKeys.single(venueId),
    queryFn: () => venueService.getVenue(),
    enabled: !!venueId,
  });

  const { data: pulseData, refetch: refetchPulse } = useQuery({
    queryKey: analyticsKeys.pulse(venueId),
    queryFn: async () => {
      const [
        liveOrders,
        helpRequests,
        tables,
        zones,
        v,
        lastCall,
        sessions,
        adjustments,
        occupancy,
        waitlistEntries,
        openIncidents,
      ] = await Promise.all([
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
      const items = computeAttentionItems(
        liveOrders,
        helpRequests,
        tables,
        zones,
        v.slaThresholds,
        lastCall.active,
        v.lastCallAutoFlagTables,
        sessions,
        adjustments,
        v.minimumSpendWarningRatio,
        {
          occupancy: occupancy.current,
          legalCapacity: occupancy.legalCapacity,
          occupancyWarnRatio: v.occupancyWarnRatio,
          waitlistEntries,
          openIncidents,
        },
      );
      return { attentionItems: items, lastCallActive: lastCall.active };
    },
    enabled: !!venueId,
    staleTime: 0,
  });

  const attentionItems = pulseData?.attentionItems ?? null;
  const lastCallActive = pulseData?.lastCallActive ?? false;

  const refreshPulseRef = useRef(refetchPulse);
  refreshPulseRef.current = refetchPulse;

  useLiveEvents({
    scope: "manager",
    onEvent: () => { refreshPulseRef.current(); },
    fallbackMs: 8000,
    fallbackRefresh: () => { refreshPulseRef.current(); },
  });

  const managerName = user?.name ?? "Manager";

  const invalidatePulse = () => {
    queryClient.invalidateQueries({ queryKey: analyticsKeys.pulse(venueId) });
  };

  const broadcastMutation = useMutation({
    mutationFn: async (message: string) => {
      await pulseService.sendBroadcast(message, managerName);
    },
    onSuccess: () => invalidatePulse(),
  });

  const lastCallMutation = useMutation({
    mutationFn: async () => {
      if (lastCallActive) {
        await pulseService.endLastCall();
      } else {
        await pulseService.startLastCall(managerName);
      }
    },
    onSuccess: () => invalidatePulse(),
  });

  const recentOrders = orders?.slice(0, 4) ?? null;
  const venueName = venue?.name ?? "Velvet Montréal";
  const currency = venue?.currency ?? "CAD";

  if (summaryError || venueError) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("tonightAt", { venueName })} />
        <QueryErrorState
          queryKeys={[analyticsKeys.summary(venueId), venueKeys.single(venueId)]}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("tonightAt", { venueName })}
        description={t("doorsLine", { date: new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) })}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/manager/analytics">
              {t("fullAnalytics")} <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        }
      />

      <Tabs defaultValue="tonight">
        <TabsList>
          <TabsTrigger value="tonight">{t("tabs.tonight")}</TabsTrigger>
          <TabsTrigger value="snapshot">{t("tabs.snapshot")}</TabsTrigger>
          <TabsTrigger value="pulse">
            {t("tabs.pulse")}
            {attentionItems !== null && attentionItems.length > 0 && (
              <Badge variant="outline" className="ml-1 px-1.5 py-0 text-[10px]">
                {attentionItems.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tonight" className="space-y-6 pt-4">
          <TonightTab summary={summary ?? null} orders={recentOrders} currency={currency} t={t} />
        </TabsContent>

        <TabsContent value="snapshot" className="space-y-6 pt-4">
          <SnapshotTab summary={summary ?? null} currency={currency} t={t} />
        </TabsContent>

        <TabsContent value="pulse" className="pt-4">
          <PulseTab
            items={attentionItems}
            lastCallActive={lastCallActive}
            onSendBroadcast={async (message: string) => { broadcastMutation.mutate(message); }}
            onToggleLastCall={async () => { lastCallMutation.mutate(); }}
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
  t,
}: {
  summary: AnalyticsSummary | null;
  orders: Order[] | null;
  currency: string;
  t: ReturnType<typeof useTranslations<"manager.dashboard">>;
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
            label={t("metrics.revenue")}
            value={formatMoney(summary.revenueTonight, currency)}
            deltaPct={summary.revenueDeltaPct}
            icon={CircleDollarSign}
            info={t("metrics.revenueInfo")}
            featured
          />
          <MetricCard
            label={t("metrics.orders")}
            value={String(summary.ordersTonight)}
            deltaPct={summary.ordersDeltaPct}
            icon={Receipt}
            info={t("metrics.ordersInfo")}
          />
          <MetricCard
            label={t("metrics.avgOrder")}
            value={formatMoney(summary.avgOrderValue, currency)}
            deltaPct={summary.avgOrderDeltaPct}
            icon={CircleDollarSign}
            info={t("metrics.avgOrderInfo")}
          />
          <MetricCard
            label={t("metrics.activeTables")}
            value={`${summary.activeTables}/${summary.totalTables}`}
            icon={Table2}
            info={t("metrics.activeTablesInfo")}
            hint={`Avg fulfillment ${summary.avgFulfillmentMinutes} min`}
          />
        </div>
      )}

      {summary?.orderEta && (
        <div className="grid grid-cols-3 gap-3">
          <MetricCard
            label={t("metrics.acceptWait")}
            value={`${summary.orderEta.avgAcceptMinutes} min`}
            icon={Timer}
            info={t("metrics.acceptWaitInfo")}
          />
          <MetricCard
            label={t("metrics.prepDelivery")}
            value={`${summary.orderEta.avgPrepMinutes} min`}
            icon={Timer}
            info={t("metrics.prepDeliveryInfo")}
          />
          <MetricCard
            label={t("metrics.totalEta")}
            value={`${summary.orderEta.avgTotalMinutes} min`}
            icon={Timer}
            info={t("metrics.totalEtaInfo")}
            featured
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">{t("revenueByHour")}</CardTitle>
          </CardHeader>
          <CardContent>
            {summary === null ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <RevenueChart data={summary.revenueByHour} />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("topSellers")}</CardTitle>
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
          <h2 className="font-semibold">{t("recentOrders")}</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/manager/orders">
              {t("openOrderFeed")} <ArrowRight className="size-3.5" />
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
  t,
}: {
  summary: AnalyticsSummary | null;
  currency: string;
  t: ReturnType<typeof useTranslations<"manager.dashboard">>;
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
              <Users className="size-4 text-primary" /> {t("cards.guestSessions")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-muted-foreground flex items-center gap-1">{t("sessions.sessions")} <InfoTip text={t("sessions.sessionsInfo")} /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.sessions.totalSessions}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">{t("sessions.approval")} <InfoTip text={t("sessions.approvalInfo")} /></p>
                <p className="text-lg font-semibold tabular-nums">{formatPct(summary.sessions.approvalRate)}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">{t("sessions.avgDuration")} <InfoTip text={t("sessions.avgDurationInfo")} /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.sessions.avgDurationMinutes} min</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">{t("sessions.partySize")} <InfoTip text={t("sessions.partySizeInfo")} /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.sessions.avgPartySize}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">{t("sessions.revPerSession")} <InfoTip text={t("sessions.revPerSessionInfo")} /></p>
                <p className="text-lg font-semibold tabular-nums">{formatMoney(summary.sessions.revenuePerSession, currency)}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">{t("sessions.revPerGuest")} <InfoTip text={t("sessions.revPerGuestInfo")} /></p>
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
              <Receipt className="size-4 text-primary" /> {t("cards.orderFunnel")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-muted-foreground flex items-center gap-1">{t("orderFunnel.placed")} <InfoTip text={t("orderFunnel.placedInfo")} /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.orderFunnel.placed}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">{t("orderFunnel.delivered")} <InfoTip text={t("orderFunnel.deliveredInfo")} /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.orderFunnel.delivered}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">{t("orderFunnel.cancelled")} <InfoTip text={t("orderFunnel.cancelledInfo")} /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.orderFunnel.cancelled} <span className="text-xs text-muted-foreground">({formatPct(summary.orderFunnel.cancellationRate)})</span></p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">{t("orderFunnel.tipRate")} <InfoTip text={t("orderFunnel.tipRateInfo")} /></p>
                <p className="text-lg font-semibold tabular-nums">{formatPct(summary.orderFunnel.tipRate)}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">{t("orderFunnel.feeRevenue")} <InfoTip text={t("orderFunnel.feeRevenueInfo")} /></p>
                <p className="text-lg font-semibold tabular-nums">{formatMoney(summary.orderFunnel.serviceFeeRevenue, currency)}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">{t("orderFunnel.giftOrders")} <InfoTip text={t("orderFunnel.giftOrdersInfo")} /></p>
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
              <CalendarCheck className="size-4 text-primary" /> {t("cards.reservations")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-muted-foreground flex items-center gap-1">{t("reservations.requested")} <InfoTip text={t("reservations.requestedInfo")} /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.reservations.requested}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">{t("reservations.seated")} <InfoTip text={t("reservations.seatedInfo")} /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.reservations.seated} <span className="text-xs text-muted-foreground">({formatPct(summary.reservations.seatedRate)})</span></p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">{t("reservations.noShows")} <InfoTip text={t("reservations.noShowsInfo")} /></p>
                <p className="text-lg font-semibold tabular-nums">{formatPct(summary.reservations.noShowRate)}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">{t("reservations.covers")} <InfoTip text={t("reservations.coversInfo")} /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.reservations.totalCovers}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">{t("reservations.cancelled")} <InfoTip text={t("reservations.cancelledInfo")} /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.reservations.cancelled} <span className="text-xs text-muted-foreground">({formatPct(summary.reservations.cancellationRate)})</span></p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">{t("reservations.avgLead")} <InfoTip text={t("reservations.avgLeadInfo")} /></p>
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
              <Clock className="size-4 text-primary" /> {t("cards.happyHours")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-muted-foreground flex items-center gap-1">{t("happyHours.hhOrders")} <InfoTip text={t("happyHours.hhOrdersInfo")} /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.happyHours.totalHhOrders}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">{t("happyHours.hhRevenue")} <InfoTip text={t("happyHours.hhRevenueInfo")} /></p>
                <p className="text-lg font-semibold tabular-nums">{formatMoney(summary.happyHours.totalHhRevenue, currency)}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">{t("happyHours.discountGiven")} <InfoTip text={t("happyHours.discountGivenInfo")} /></p>
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
              <PartyPopper className="size-4 text-primary" /> {t("cards.events")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-muted-foreground flex items-center gap-1">{t("events.eventsTonight")} <InfoTip text={t("events.eventsTonightInfo")} /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.events.totalEvents}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">{t("events.avgUtilization")} <InfoTip text={t("events.avgUtilizationInfo")} /></p>
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
              <Tag className="size-4 text-primary" /> {t("cards.promotions")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-muted-foreground flex items-center gap-1">{t("promotions.redemptions")} <InfoTip text={t("promotions.redemptionsInfo")} /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.promotions.totalRedemptions}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">{t("promotions.discountCost")} <InfoTip text={t("promotions.discountCostInfo")} /></p>
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
              <Timer className="size-4 text-primary" /> {t("cards.orderEta")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-muted-foreground flex items-center gap-1">{t("metrics.acceptWait")} <InfoTip text={t("metrics.acceptWaitInfo")} /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.orderEta.avgAcceptMinutes} min</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">{t("metrics.prepDelivery")} <InfoTip text={t("metrics.prepDeliveryInfo")} /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.orderEta.avgPrepMinutes} min</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">{t("metrics.totalEta")} <InfoTip text={t("metrics.totalEtaInfo")} /></p>
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
              <Users className="size-4 text-primary" /> {t("cards.helpFulfilment")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-muted-foreground flex items-center gap-1">{t("helpFulfilment.helpResolved")} <InfoTip text={t("helpFulfilment.helpResolvedInfo")} /></p>
                <p className="text-lg font-semibold tabular-nums">
                  {summary.staffPerformance.filter((p) => p.role === "runner").reduce((s, p) => s + (p.helpResolved ?? 0), 0)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">{t("helpFulfilment.avgHelpTime")} <InfoTip text={t("helpFulfilment.avgHelpTimeInfo")} /></p>
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
              <Receipt className="size-4 text-primary" /> {t("cards.inventoryDepth")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-muted-foreground flex items-center gap-1">{t("inventoryDepth.soldOutEvents")} <InfoTip text={t("inventoryDepth.soldOutEventsInfo")} /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.inventoryDepth.soldOutEventsPerNight}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">{t("inventoryDepth.soldOutMin")} <InfoTip text={t("inventoryDepth.soldOutMinInfo")} /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.inventoryDepth.totalSoldOutMinutes}</p>
              </div>
              <div>
                <p className="text-muted-foreground flex items-center gap-1">{t("inventoryDepth.deadItems")} <InfoTip text={t("inventoryDepth.deadItemsInfo")} /></p>
                <p className="text-lg font-semibold tabular-nums">{summary.inventoryDepth.deadItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
