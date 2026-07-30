"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, Inbox, PartyPopper, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { canDo } from "@/features/shared/permissions";
import { permissionService } from "@/features/platform/permission-service";
import type { RolePermissions } from "@/features/shared/permissions";
import { ordersKeys } from "@/features/ordering/query-keys";
import { staffKeys } from "@/features/workforce/query-keys";
import { venueKeys } from "@/features/venue/query-keys";
import { showQueueKeys } from "@/features/realtime/query-keys";
import { permissionsKeys } from "@/features/platform/query-keys";
import { sessionsKeys } from "@/features/guests/query-keys";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/features/shared/utils";
import { useLiveEvents } from "@/lib/use-live-events";
import { useInfiniteSlice } from "@/hooks/use-infinite-slice";
import { InfiniteScrollSentinel } from "@/components/shared/infinite-scroll-sentinel";
import { Wallet } from "lucide-react";
import type { ActiveShow, Order, OrderStatus, StaffMember, TabAdjustmentKind } from "@/lib/types";

const ADVANCE_LABEL: Partial<Record<OrderStatus, string>> = {
  pending: "Accept order",
  accepted: "Start preparing",
  preparing: "Mark ready",
  ready: "Mark delivered",
};

const RUNNER_HINT: Partial<Record<OrderStatus, string>> = {
  pending: "Awaiting bartender",
};

const FILTERS: { id: "active" | "new" | "done"; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "new", label: "New" },
  { id: "done", label: "Done" },
];

function StaffOrdersContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const venueId = user?.venueId ?? "";
  const queryClient = useQueryClient();

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

  const { data: permissions } = useQuery({
    queryKey: permissionsKeys.role(venueId),
    queryFn: () => permissionService.getRolePermissions("venue-1"),
    enabled: !!venueId,
  });

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
      if (updated) toast.success(`${order.code} → ${updated.status}`);
      invalidate();
      queryClient.invalidateQueries({ queryKey: showQueueKeys.active(venueId) });
    },
    onError: (error, order) => {
      toast.error(error instanceof Error ? error.message : `Could not update ${order.code}`);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (order: Order) => ordersService.cancelOrder(order.id),
    onSuccess: (updated, order) => {
      if (!updated) toast.error(`${order.code} is already delivered or cancelled.`);
      else toast.info(`${order.code} cancelled — stock returned`);
      invalidate();
    },
    onError: (error, order) => {
      toast.error(error instanceof Error ? error.message : `Could not cancel ${order.code}`);
    },
  });

  const claimMutation = useMutation({
    mutationFn: (order: Order) => ordersService.claimOrder(order.id, me!.id, me!.name),
    onSuccess: (updated, order) => {
      if (!updated) toast.error("Someone just claimed this order.");
      else toast.success(`${order.code} claimed`);
      invalidate();
    },
    onError: (error, order) => {
      toast.error(error instanceof Error ? error.message : `Could not claim ${order.code}`);
    },
  });

  const releaseMutation = useMutation({
    mutationFn: (order: Order) => ordersService.releaseOrder(order.id),
    onSuccess: (_, order) => {
      toast.info(`${order.code} released back to the queue`);
      invalidate();
    },
    onError: (error, order) => {
      toast.error(error instanceof Error ? error.message : `Could not release ${order.code}`);
    },
  });

  const startShowMutation = useMutation({
    mutationFn: (order: Order) => showQueueService.startShow(order, me!.name),
    onSuccess: (result, order) => {
      if (!result.ok) {
        toast.error(`Show floor busy — ${result.activeShow?.tableCode}'s presentation is walking.`);
      } else {
        toast.success(`${order.tableCode}'s presentation is walking now`);
      }
      invalidate();
      queryClient.invalidateQueries({ queryKey: showQueueKeys.active(venueId) });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not start the presentation");
    },
  });

  const finishShowMutation = useMutation({
    mutationFn: () => showQueueService.finishShow(),
    onSuccess: () => {
      toast.info("Show floor is clear");
      queryClient.invalidateQueries({ queryKey: showQueueKeys.active(venueId) });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not finish the presentation");
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
        <h1 className="text-display text-xl">Order feed</h1>
        <Button variant="ghost" size="icon" onClick={invalidate} aria-label="Refresh">
          <RefreshCw className="size-4" />
        </Button>
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
              My zones
            </Label>
          </div>
        )}
      </div>

      {ordersLoading && !orders ? (
        <ListSkeleton rows={3} rowHeight="h-36" />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Queue is clear"
          description="Orders placed by guests will appear here. Claim one to start delivering."
        />
      ) : (
        <div className="stagger-children space-y-3">
          {sliced.map((order) => {
            const label = ADVANCE_LABEL[order.status];
            const canAccept = (me && permissions) ? canDo(permissions, me.role, "order:accept") : true;
            const isPending = order.status === "pending";
            const runnerHint = isPending && !canAccept ? RUNNER_HINT[order.status] : undefined;
            const availableKinds: TabAdjustmentKind[] = permissions && me
              ? (["void", "comp", "discount"] as const).filter((k) => canDo(permissions, me.role, `tab:${k}` as const))
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
                    <Wallet className="size-3.5" /> Adjust tab
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
                            Claimed by{" "}
                            <span className="font-medium text-foreground">
                              {order.claimedByStaffId === me?.id ? "you" : order.claimedByStaffName}
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Unclaimed</span>
                        )}
                        {order.claimedByStaffId === me?.id ? (
                          <button
                            type="button"
                            onClick={() => releaseMutation.mutate(order)}
                            className="font-medium text-primary hover:underline"
                          >
                            Release
                          </button>
                        ) : !order.claimedByStaffId && permissions && canDo(permissions, me?.role ?? "runner", "order:claim") ? (
                          <button
                            type="button"
                            onClick={() => claimMutation.mutate(order)}
                            className="font-medium text-primary hover:underline"
                          >
                            Claim
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
                                    <PartyPopper className="size-3.5" /> Walking now — {(activeShow as ActiveShow).label}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => finishShowMutation.mutate()}
                                    className="font-medium text-primary hover:underline"
                                  >
                                    Finish show
                                  </button>
                                </div>
                              ) : activeShow ? (
                                <span className="text-muted-foreground">
                                  Show floor busy — {(activeShow as ActiveShow).tableCode}&apos;s presentation is walking
                                </span>
                              ) : (
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">Needs a presentation walk-out</span>
                                  <button
                                    type="button"
                                    onClick={() => startShowMutation.mutate(order)}
                                    className="font-medium text-primary hover:underline"
                                  >
                                    Start show
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                          <div className="flex gap-2">
                            <ConfirmDialog
                              trigger={
                                <Button className="h-11 flex-1" disabled={isBusy(order.id)}>
                                  <CheckCheck className="size-4" />
                                  {isBusy(order.id) ? "Updating…" : label}
                                </Button>
                              }
                              title={`${label} — ${order.code}?`}
                              description={`${order.tableCode} · ${order.guestName} · the guest sees the status change immediately.`}
                              confirmLabel={label ?? "Confirm"}
                              onConfirm={() => advanceMutation.mutate(order)}
                            />
                            {isPending && (
                              <ConfirmDialog
                                trigger={
                                  <Button variant="outline" size="icon" className="h-11 w-11 text-red-600 dark:text-red-400" aria-label="Cancel order">
                                    <XCircle className="size-4" />
                                  </Button>
                                }
                                title={`Cancel ${order.code}?`}
                                description="The guest will see their order as cancelled. This can't be undone."
                                confirmLabel="Cancel order"
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
