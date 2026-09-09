"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, Inbox, PartyPopper, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TooltipIconButton } from "@/components/shared/tooltip-icon-button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { OrderCard } from "@/components/shared/order-card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { AdjustmentDialog } from "@/components/shared/adjustment-dialog";
import { ordersService, nextStatus } from "@/features/ordering/services";
import { guestsService } from "@/features/guests/services";
import { showQueueService, orderNeedsShow } from "@/features/realtime/show-queue-service";
import { staffService } from "@/features/workforce/staff-service";
import { venueService } from "@/features/venue/services";
import { usePermissions } from "@/features/platform/use-permissions";
import { ordersKeys } from "@/features/ordering/query-keys";
import { staffKeys } from "@/features/workforce/query-keys";
import { venueKeys } from "@/features/venue/query-keys";
import { showQueueKeys } from "@/features/realtime/query-keys";
import { sessionsKeys } from "@/features/guests/query-keys";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/features/shared/utils";
import { useLiveEvents } from "@/lib/use-live-events";
import { useInfiniteSlice } from "@/hooks/use-infinite-slice";
import { InfiniteScrollSentinel } from "@/components/shared/infinite-scroll-sentinel";
import { useTranslations } from "next-intl";
import { Wallet } from "lucide-react";
import type { ActiveShow, Order, OrderStatus, StaffMember, TabAdjustmentKind } from "@/lib/types";


function StaffOrdersContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const venueId = user?.venueId ?? "";
  const queryClient = useQueryClient();
  const t = useTranslations("staff.orders");

  const ADVANCE_LABEL: Partial<Record<OrderStatus, string>> = {
    pending: t("advanceLabel.pending"),
    accepted: t("advanceLabel.accepted"),
    preparing: t("advanceLabel.preparing"),
    ready: t("advanceLabel.ready"),
  };

  const RUNNER_HINT: Partial<Record<OrderStatus, string>> = {
    pending: t("runnerHint"),
  };

  const FILTERS: { id: "active" | "new" | "done"; label: string }[] = [
    { id: "active", label: t("filters.active") },
    { id: "new", label: t("filters.new") },
    { id: "done", label: t("filters.done") },
  ];

  const [filter, setFilter] = useState<"active" | "new" | "done">("active");
  const [zoneScoped, setZoneScoped] = useState(searchParams.get("scope") === "mine");
  const tableFilter = searchParams.get("table");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ordersKeys.all(venueId) });

  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ordersKeys.all(venueId),
    queryFn: () => ordersService.listOrders(),
    enabled: !!venueId,
  });

  const { data: me } = useQuery({
    queryKey: staffKeys.me(venueId),
    queryFn: () => staffService.getCurrentStaff(),
    enabled: !!venueId,
  });

  const { data: activeShow } = useQuery({
    queryKey: showQueueKeys.active(venueId),
    queryFn: () => showQueueService.getActiveShow(),
    enabled: !!venueId,
  });

  const { can } = usePermissions();

  const { data: venue } = useQuery({
    queryKey: venueKeys.snapshot(venueId),
    queryFn: () => venueService.getVenueSnapshot(),
    enabled: !!venueId,
  });

  const { data: allSessions } = useQuery({
    queryKey: sessionsKeys.all(venueId),
    queryFn: () => guestsService.listSessions(),
    enabled: !!venueId && me?.role === "promoter",
  });

  const promoterSessionIds = me?.role === "promoter" && allSessions
    ? new Set(allSessions.filter((s) => s.promoterId === me.id).map((s) => s.id))
    : null;

  const compThresholdCents = venue?.compThresholdCents ?? 0;

  useLiveEvents({
    scope: "staff",
    onEvent: invalidate,
    fallbackMs: 8000,
    fallbackRefresh: invalidate,
  });

  const advanceMutation = useMutation({
    mutationFn: (order: Order) => ordersService.advanceOrder(order.id),
    onSuccess: (updated, order) => {
      if (updated) toast.success(t("toastAdvanceSuccess", { code: order.code, status: updated.status }));
      invalidate();
      queryClient.invalidateQueries({ queryKey: showQueueKeys.active(venueId) });
    },
    onError: (error, order) => {
      toast.error(error instanceof Error ? error.message : t("toastAdvanceFailed", { code: order.code }));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (order: Order) => ordersService.cancelOrder(order.id),
    onSuccess: (updated, order) => {
      if (!updated) toast.error(t("toastAlreadyDelivered", { code: order.code }));
      else toast.info(t("toastCancelled", { code: order.code }));
      invalidate();
    },
    onError: (error, order) => {
      toast.error(error instanceof Error ? error.message : t("toastCancelFailed", { code: order.code }));
    },
  });

  const claimMutation = useMutation({
    mutationFn: (order: Order) => ordersService.claimOrder(order.id, me!.id, me!.name),
    onSuccess: (updated, order) => {
      if (!updated) toast.error(t("toastAlreadyClaimed"));
      else toast.success(t("toastClaimed", { code: order.code }));
      invalidate();
    },
    onError: (error, order) => {
      toast.error(error instanceof Error ? error.message : t("toastClaimFailed", { code: order.code }));
    },
  });

  const releaseMutation = useMutation({
    mutationFn: (order: Order) => ordersService.releaseOrder(order.id),
    onSuccess: (_, order) => {
      toast.info(t("toastReleased", { code: order.code }));
      invalidate();
    },
    onError: (error, order) => {
      toast.error(error instanceof Error ? error.message : t("toastReleaseFailed", { code: order.code }));
    },
  });

  const startShowMutation = useMutation({
    mutationFn: (order: Order) => showQueueService.startShow(order, me!.name),
    onSuccess: (result, order) => {
      if (!result.ok) {
        toast.error(t("toastShowFloorBusy", { tableCode: result.activeShow?.tableCode ?? "?" }));
      } else {
        toast.success(t("toastShowWalkingNow", { tableCode: order.tableCode }));
      }
      invalidate();
      queryClient.invalidateQueries({ queryKey: showQueueKeys.active(venueId) });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toastShowFailed"));
    },
  });

  const finishShowMutation = useMutation({
    mutationFn: () => showQueueService.finishShow(),
    onSuccess: () => {
      toast.info(t("toastShowClear"));
      queryClient.invalidateQueries({ queryKey: showQueueKeys.active(venueId) });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : t("toastShowFinishFailed"));
    },
  });

  const isPromoter = me?.role === "promoter";

  const visible = (orders ?? []).filter((o) => {
    if (tableFilter && o.tableId !== tableFilter) return false;
    if (isPromoter && promoterSessionIds && o.sessionId && !promoterSessionIds.has(o.sessionId)) return false;
    if (isPromoter && promoterSessionIds && !o.sessionId) return false;
    if (zoneScoped && me && !isPromoter && !me.assignedZoneIds.includes(o.zoneId)) return false;
    if (filter === "new") return o.status === "pending";
    if (filter === "done") return ["delivered", "cancelled"].includes(o.status);
    return !["delivered", "cancelled"].includes(o.status);
  });

  const { sliced, hasMore, loadMore, reset } = useInfiniteSlice(visible, 10);

  useEffect(() => { reset(); }, [filter, zoneScoped, tableFilter, reset]);

  function isBusy(orderId: string) {
    return (
      (advanceMutation.isPending && advanceMutation.variables?.id === orderId) ||
      (cancelMutation.isPending && cancelMutation.variables?.id === orderId) ||
      (claimMutation.isPending && claimMutation.variables?.id === orderId) ||
      (releaseMutation.isPending && releaseMutation.variables?.id === orderId) ||
      (startShowMutation.isPending && startShowMutation.variables?.id === orderId)
    );
  }

  return (
    <div className="animate-fade-in space-y-5 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display text-xl">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <TooltipIconButton variant="ghost" tooltip={t("refresh")} onClick={invalidate}>
          <RefreshCw className="size-4" />
        </TooltipIconButton>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                filter === f.id
                  ? "border-primary bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {!isPromoter && (
          <div className="flex items-center gap-2">
            <Switch id="zone-scope" checked={zoneScoped} onCheckedChange={setZoneScoped} />
            <Label htmlFor="zone-scope" className="text-xs text-muted-foreground">
              {t("myZones")}
            </Label>
          </div>
        )}
      </div>

      {ordersLoading && !orders ? (
        <ListSkeleton rows={3} rowHeight="h-36" />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={t("emptyTitle")}
          description={t("emptyDesc")}
        />
      ) : (
        <div className="stagger-children space-y-3">
          {sliced.map((order) => {
            const label = ADVANCE_LABEL[order.status];
            const canAccept = can("order:accept");
            const isPending = order.status === "pending";
            const runnerHint = isPending && !canAccept ? RUNNER_HINT[order.status] : undefined;
            const availableKinds: TabAdjustmentKind[] = me
              ? (["void", "comp", "discount"] as const).filter((k) => can(`tab:${k}` as const))
              : [];
            const canAdjust = !isPromoter && !!order.sessionId && !isPending && order.status !== "cancelled" && availableKinds.length > 0;
            const adjustButton = canAdjust && me ? (
              <AdjustmentDialog
                order={order}
                availableKinds={availableKinds}
                authorStaffId={me.id}
                authorStaffName={me.name}
                compThresholdCents={compThresholdCents}
                isManager={me.role === "manager"}
                onDone={invalidate}
                trigger={
                  <Button variant="outline" size="sm" className="w-full">
                    <Wallet className="size-3.5" /> {t("adjustTab")}
                  </Button>
                }
              />
            ) : null;
            return (
              <OrderCard
                key={order.id}
                order={order}
                footer={
                  label && !isPromoter ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        {order.claimedByStaffId ? (
                          <span className="text-muted-foreground">
                            {t("claimedBy")}{" "}
                            <span className="font-medium text-foreground">
                              {order.claimedByStaffId === me?.id ? t("you") : order.claimedByStaffName}
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{t("unclaimed")}</span>
                        )}
                        {order.claimedByStaffId === me?.id ? (
                          <button
                            type="button"
                            onClick={() => releaseMutation.mutate(order)}
                            className="font-medium text-primary hover:underline"
                          >
                            {t("release")}
                          </button>
                        ) : !order.claimedByStaffId && can("order:claim") ? (
                          <button
                            type="button"
                            onClick={() => claimMutation.mutate(order)}
                            className="font-medium text-primary hover:underline"
                          >
                            {t("claim")}
                          </button>
                        ) : null}
                      </div>
                      {runnerHint ? (
                        <p className="rounded-lg border border-muted bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                          {runnerHint}
                        </p>
                      ) : (
                        <>
                          {orderNeedsShow(order) && order.status === "ready" && (
                            <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 text-xs">
                              {(activeShow as ActiveShow | null)?.orderId === order.id ? (
                                <div className="flex items-center justify-between">
                                  <span className="flex items-center gap-1.5 font-medium text-primary">
                                    <PartyPopper className="size-3.5" /> {t("walkingNow", { label: (activeShow as ActiveShow).label })}
                                  </span>
                                  {can("show:control") && (
                                    <button
                                      type="button"
                                      onClick={() => finishShowMutation.mutate()}
                                      className="font-medium text-primary hover:underline"
                                    >
                                      {t("finishShow")}
                                    </button>
                                  )}
                                </div>
                              ) : activeShow ? (
                                <span className="text-muted-foreground">
                                  {t("showFloorBusy", { tableCode: (activeShow as ActiveShow).tableCode })}
                                </span>
                              ) : (
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">{t("needsPresentationWalkout")}</span>
                                  {can("show:control") && (
                                    <button
                                      type="button"
                                      onClick={() => startShowMutation.mutate(order)}
                                      className="font-medium text-primary hover:underline"
                                    >
                                      {t("startShow")}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                          <div className="flex gap-2">
                            <ConfirmDialog
                              trigger={
                                <Button className="h-11 flex-1" disabled={isBusy(order.id)}>
                                  <CheckCheck className="size-4" />
                                  {isBusy(order.id) ? t("updating") : label}
                                </Button>
                              }
                              title={t("advanceConfirmTitle", { label: label!, code: order.code })}
                              description={t("advanceConfirmDesc", { tableCode: order.tableCode, guestName: order.guestName })}
                              confirmLabel={label ?? t("confirm")}
                              onConfirm={() => advanceMutation.mutate(order)}
                            />
                            {isPending && can("order:cancel") && (
                              <ConfirmDialog
                                trigger={
                                  <Button variant="outline" size="icon" className="h-11 w-11 text-red-600 dark:text-red-400" aria-label={t("cancelAria")}>
                                    <XCircle className="size-4" />
                                  </Button>
                                }
                                title={t("cancelTitle", { code: order.code })}
                                description={t("cancelDesc")}
                                confirmLabel={t("cancelConfirm")}
                                destructive
                                onConfirm={() => cancelMutation.mutate(order)}
                              />
                            )}
                          </div>
                        </>
                      )}
                      {adjustButton}
                    </div>
                  ) : adjustButton ? (
                    <div>{adjustButton}</div>
                  ) : undefined
                }
              />
            );
          })}
        </div>
      )}
      <InfiniteScrollSentinel onLoadMore={loadMore} hasMore={hasMore} />
    </div>
  );
}

export default function StaffOrdersPage() {
  return (
    <Suspense fallback={<div className="p-4"><ListSkeleton rows={3} rowHeight="h-36" /></div>}>
      <StaffOrdersContent />
    </Suspense>
  );
}
