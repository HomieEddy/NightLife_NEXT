"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCheck, Inbox, PartyPopper, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { OrderCard } from "@/components/shared/order-card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ordersService, nextStatus } from "@/lib/services/orders-service";
import { showQueueService, orderNeedsShow } from "@/lib/services/show-queue-service";
import { staffService } from "@/lib/services/staff-service";
import { cn } from "@/lib/utils";
import type { ActiveShow, Order, OrderStatus, StaffMember } from "@/lib/types";

const ADVANCE_LABEL: Partial<Record<OrderStatus, string>> = {
  pending: "Accept order",
  accepted: "Start preparing",
  preparing: "Mark ready",
  ready: "Mark delivered",
};

const FILTERS: { id: "active" | "new" | "done"; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "new", label: "New" },
  { id: "done", label: "Done" },
];

function StaffOrdersContent() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [me, setMe] = useState<StaffMember | null>(null);
  const [filter, setFilter] = useState<"active" | "new" | "done">("active");
  const [zoneScoped, setZoneScoped] = useState(searchParams.get("scope") === "mine");
  // Forward-compatible hook for manager/floor-map links into the feed.
  const tableFilter = searchParams.get("table");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeShow, setActiveShow] = useState<ActiveShow | null>(null);

  const refresh = useCallback(async () => {
    const [orderList, currentStaff, show] = await Promise.all([
      ordersService.listOrders(),
      staffService.getCurrentStaff(),
      showQueueService.getActiveShow(),
    ]);
    setOrders(orderList);
    setMe(currentStaff);
    setActiveShow(show);
  }, []);

  useEffect(() => {
    refresh();
    // TODO(backend): WebSocket push instead of polling.
    const interval = setInterval(refresh, 8000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function advance(order: Order) {
    setBusyId(order.id);
    const updated = await ordersService.advanceOrder(order.id);
    if (updated) toast.success(`${order.code} → ${updated.status}`);
    await refresh();
    setBusyId(null);
  }

  async function cancel(order: Order) {
    await ordersService.cancelOrder(order.id);
    toast.info(`${order.code} cancelled`);
    await refresh();
  }

  async function claim(order: Order) {
    if (!me) return;
    const updated = await ordersService.claimOrder(order.id, me.id, me.name);
    if (!updated) toast.error("Someone just claimed this order.");
    else toast.success(`${order.code} claimed`);
    await refresh();
  }

  async function release(order: Order) {
    await ordersService.releaseOrder(order.id);
    toast.info(`${order.code} released back to the queue`);
    await refresh();
  }

  async function startShow(order: Order) {
    if (!me) return;
    const result = await showQueueService.startShow(order, me.name);
    if (!result.ok) {
      toast.error(`Show floor busy — ${result.activeShow?.tableCode}'s presentation is walking.`);
    } else {
      toast.success(`${order.tableCode}'s presentation is walking now`);
    }
    await refresh();
  }

  async function finishShow() {
    await showQueueService.finishShow();
    toast.info("Show floor is clear");
    await refresh();
  }

  const visible = (orders ?? []).filter((o) => {
    if (tableFilter && o.tableId !== tableFilter) return false;
    if (zoneScoped && me && !me.assignedZoneIds.includes(o.zoneId)) return false;
    if (filter === "new") return o.status === "pending";
    if (filter === "done") return ["delivered", "cancelled"].includes(o.status);
    return !["delivered", "cancelled"].includes(o.status);
  });

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Order feed</h1>
        <Button variant="ghost" size="icon" onClick={refresh} aria-label="Refresh">
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
        <div className="flex items-center gap-2">
          <Switch id="zone-scope" checked={zoneScoped} onCheckedChange={setZoneScoped} />
          <Label htmlFor="zone-scope" className="text-xs text-muted-foreground">
            My zones
          </Label>
        </div>
      </div>

      {orders === null ? (
        <ListSkeleton rows={3} rowHeight="h-36" />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Queue is clear"
          description={
            zoneScoped
              ? "No orders in your zones right now. Nice work."
              : "No orders match this filter."
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((order) => {
            const label = ADVANCE_LABEL[order.status];
            return (
              <OrderCard
                key={order.id}
                order={order}
                footer={
                  label ? (
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
                            onClick={() => release(order)}
                            className="font-medium text-primary hover:underline"
                          >
                            Release
                          </button>
                        ) : !order.claimedByStaffId ? (
                          <button
                            type="button"
                            onClick={() => claim(order)}
                            className="font-medium text-primary hover:underline"
                          >
                            Claim
                          </button>
                        ) : null}
                      </div>
                      {orderNeedsShow(order) && order.status === "ready" && (
                        <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 text-xs">
                          {activeShow?.orderId === order.id ? (
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1.5 font-medium text-primary">
                                <PartyPopper className="size-3.5" /> Walking now — {activeShow.label}
                              </span>
                              <button
                                type="button"
                                onClick={finishShow}
                                className="font-medium text-primary hover:underline"
                              >
                                Finish show
                              </button>
                            </div>
                          ) : activeShow ? (
                            <span className="text-muted-foreground">
                              Show floor busy — {activeShow.tableCode}&apos;s presentation is walking
                            </span>
                          ) : (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Needs a presentation walk-out</span>
                              <button
                                type="button"
                                onClick={() => startShow(order)}
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
                          <Button className="h-11 flex-1" disabled={busyId === order.id}>
                            <CheckCheck className="size-4" />
                            {busyId === order.id ? "Updating…" : label}
                          </Button>
                        }
                        title={`${label} — ${order.code}?`}
                        description={`${order.tableCode} · ${order.guestName} · the guest sees the status change immediately.`}
                        confirmLabel={label ?? "Confirm"}
                        onConfirm={() => advance(order)}
                      />
                      {order.status === "pending" && (
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
                          onConfirm={() => cancel(order)}
                        />
                      )}
                      </div>
                    </div>
                  ) : undefined
                }
              />
            );
          })}
        </div>
      )}
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
