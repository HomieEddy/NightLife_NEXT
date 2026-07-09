"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCheck, Inbox, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { OrderCard } from "@/components/shared/order-card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { mockOrdersService, nextStatus } from "@/lib/mock-services/orders-service";
import { mockStaffService } from "@/lib/mock-services/staff-service";
import { cn } from "@/lib/utils";
import type { Order, OrderStatus, StaffMember } from "@/lib/types";

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

  const refresh = useCallback(async () => {
    const [orderList, currentStaff] = await Promise.all([
      mockOrdersService.listOrders(),
      mockStaffService.getCurrentStaff(),
    ]);
    setOrders(orderList);
    setMe(currentStaff);
  }, []);

  useEffect(() => {
    refresh();
    // TODO(backend): WebSocket push instead of polling.
    const interval = setInterval(refresh, 8000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function advance(order: Order) {
    setBusyId(order.id);
    const updated = await mockOrdersService.advanceOrder(order.id);
    if (updated) toast.success(`${order.code} → ${updated.status}`);
    await refresh();
    setBusyId(null);
  }

  async function cancel(order: Order) {
    await mockOrdersService.cancelOrder(order.id);
    toast.info(`${order.code} cancelled`);
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
