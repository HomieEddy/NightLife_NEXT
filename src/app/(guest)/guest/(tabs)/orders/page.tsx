"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Loader2,
  Receipt,
  ReceiptText,
  Tag,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { useGuest } from "@/context/guest-context";
import { useLiveEvents } from "@/lib/use-live-events";
import { analyticsService } from "@/lib/services/analytics-service";
import { guestsService } from "@/lib/services/guests-service";
import { ordersService, ORDER_FLOW } from "@/lib/services/orders-service";
import { estimateEtaMinutes, formatEta } from "@/lib/eta";
import { formatMoney, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Order } from "@/lib/types";
import { DemoClosureApprovalControl, DemoOrderProgressControl } from "@/components/shared/demo-controls";

const STEP_LABELS: Record<(typeof ORDER_FLOW)[number], string> = {
  pending: "Sent",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "On its way",
  delivered: "Delivered",
};

function OrderTracker({ order }: { order: Order }) {
  const currentIndex = (ORDER_FLOW as readonly string[]).indexOf(order.status);
  if (order.status === "cancelled") return null;
  return (
    <div className="flex items-center gap-1">
      {ORDER_FLOW.map((step, i) => {
        const done = i <= currentIndex;
        return (
          <div key={step} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full items-center">
              <div
                className={cn(
                  "h-0.5 flex-1",
                  i === 0 ? "bg-transparent" : done ? "bg-primary" : "bg-border",
                )}
              />
              <div
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground",
                  i === currentIndex && "animate-pulse glow-primary",
                )}
              >
                {done && i < currentIndex ? <Check className="size-3" /> : i + 1}
              </div>
              <div
                className={cn(
                  "h-0.5 flex-1",
                  i === ORDER_FLOW.length - 1
                    ? "bg-transparent"
                    : i < currentIndex
                      ? "bg-primary"
                      : "bg-border",
                )}
              />
            </div>
            <span
              className={cn(
                "text-[10px]",
                i === currentIndex ? "font-semibold text-primary" : "text-muted-foreground",
              )}
            >
              {STEP_LABELS[step]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function GuestOrdersPage() {
  const router = useRouter();
  const { guestName, sessionId, closureStatus, setClosureStatus } = useGuest();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [requestingClosure, setRequestingClosure] = useState(false);
  const [approvingClosure, setApprovingClosure] = useState(false);
  const [avgFulfillmentMinutes, setAvgFulfillmentMinutes] = useState(8);

  useEffect(() => {
    analyticsService.getSummary().then((s) => setAvgFulfillmentMinutes(s.avgFulfillmentMinutes));
  }, []);

  const refresh = useCallback(async () => {
    if (!guestName) {
      setOrders([]);
      return;
    }
    const result = await ordersService.listGuestOrders(guestName);
    setOrders(result);
    // While waiting for the host to close the tab, watch the session status.
    if (closureStatus === "requested" && sessionId) {
      const session = await guestsService.getSession(sessionId);
      if (session?.status === "closed") setClosureStatus("closed");
    }
  }, [guestName, closureStatus, sessionId, setClosureStatus]);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => { refresh(); }, [refresh]);

  useLiveEvents({
    scope: "guest",
    sessionId: sessionId ?? undefined,
    onEvent: () => refreshRef.current(),
    fallbackMs: 5000,
    fallbackRefresh: () => refreshRef.current(),
  });

  useEffect(() => {
    if (closureStatus === "closed") router.push("/guest/receipt");
  }, [closureStatus, router]);

  async function requestClosure() {
    if (!sessionId) return;
    setRequestingClosure(true);
    try {
      await guestsService.requestClosure(sessionId);
      setClosureStatus("requested");
      toast.success("Closure requested — your host will confirm shortly.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not request tab closure");
    } finally {
      setRequestingClosure(false);
    }
  }

  async function simulateClosureApproval() {
    if (!sessionId) return;
    setApprovingClosure(true);
    try {
      await guestsService.setSessionStatus(sessionId, "closed");
      setClosureStatus("closed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not close the demo session");
    } finally {
      setApprovingClosure(false);
    }
  }

  async function simulateProgress() {
    if (!orders) return;
    const active = orders.find((o) => !["delivered", "cancelled"].includes(o.status));
    if (!active) return;
    setAdvancing(true);
    try {
      await ordersService.advanceOrder(active.id);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not advance the demo order");
    } finally {
      setAdvancing(false);
    }
  }

  if (orders === null) {
    return (
      <div className="p-4">
        <ListSkeleton rows={2} rowHeight="h-40" />
      </div>
    );
  }

  const hasActive = orders.some((o) => !["delivered", "cancelled"].includes(o.status));
  const delivered = orders.filter((o) => o.status === "delivered");
  // Tab can be closed only when there's something to pay for and nothing in flight.
  const canRequestClosure =
    delivered.length > 0 && !hasActive && sessionId !== null && closureStatus === "none";

  return (
    <div className="space-y-4 p-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Your orders</h1>
        {hasActive && <DemoOrderProgressControl busy={advancing} onProgress={simulateProgress} />}
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No orders yet"
          description="Once you place an order you can track it here in real time."
          action={
            <Button asChild>
              <Link href="/guest/menu">Browse menu</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4 stagger-children">
        {orders.map((order) => (
          <Card key={order.id} className="py-4 gap-3">
            <CardContent className="space-y-4 px-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-sm font-semibold">{order.code}</p>
                  <p className="text-xs text-muted-foreground">
                    {order.items.reduce((n, i) => n + i.quantity, 0)} items ·{" "}
                    {timeAgo(order.placedAt)}
                  </p>
                  {order.promotionCode && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-primary">
                      <Tag className="size-3" /> {order.promotionCode}
                      {order.promotionCents ? ` (−${formatMoney(order.promotionCents / 100)})` : ""}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={order.status} pulse={order.status === "pending"} />
                  <span className="text-sm font-semibold tabular-nums">
                    {formatMoney(order.total)}
                  </span>
                </div>
              </div>

              {(() => {
                const eta = formatEta(estimateEtaMinutes(order, avgFulfillmentMinutes));
                return eta ? (
                  <p className="text-xs font-medium text-primary">{eta}</p>
                ) : null;
              })()}

              <OrderTracker order={order} />

              {order.status === "delivered" && (
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href={`/guest/receipt?order=${order.id}`}>
                    <ReceiptText className="size-4" /> View receipt
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        </div>
      )}

      {canRequestClosure && (
        <Card className="animate-pop-in border-primary/40 py-4">
          <CardContent className="space-y-3 px-4 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/15">
              <Wallet className="size-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold">All orders delivered</p>
              <p className="text-sm text-muted-foreground">
                Ready to head out? Ask your host to close the tab and get your night&apos;s
                receipt.
              </p>
            </div>
            <Button
              size="lg"
              className="h-12 w-full glow-primary"
              onClick={requestClosure}
              disabled={requestingClosure}
            >
              {requestingClosure && <Loader2 className="size-4 animate-spin" />}
              {requestingClosure ? "Requesting…" : "Request to close my tab"}
            </Button>
          </CardContent>
        </Card>
      )}

      {closureStatus === "requested" && (
        <Card className="animate-pop-in border-amber-500/40 py-4">
          <CardContent className="space-y-3 px-4 text-center">
            <div className="mx-auto flex size-12 animate-bounce-soft items-center justify-center rounded-full bg-amber-500/15">
              <Wallet className="size-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-semibold">Waiting for your host…</p>
              <p className="text-sm text-muted-foreground">
                Your closure request was sent. Once approved, your full receipt for the night
                appears here.
              </p>
            </div>
            <DemoClosureApprovalControl busy={approvingClosure} onApprove={simulateClosureApproval} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
