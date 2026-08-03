"use client";

import { useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Clock,
  Loader2,
  Receipt,
  ReceiptText,
  Tag,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { useGuest } from "@/context/guest-context";
import { isDemoMode } from "@/features/shared/app-mode";
import { useLiveEvents } from "@/lib/use-live-events";
import { analyticsService } from "@/features/analytics/analytics-service";
import { guestsService } from "@/features/guests/services";
import { ordersService, ORDER_FLOW } from "@/features/ordering/services";
import { guestOrderKeys } from "@/features/ordering/query-keys";
import { estimateEtaMinutes, formatEta } from "@/features/shared/eta";
import { formatMoney } from "@/features/shared/format";
import { cn } from "@/features/shared/utils";
import type { Order } from "@/lib/types";
import { DemoClosureApprovalControl, DemoOrderProgressControl } from "@/components/shared/demo-controls";

// STEP_LABELS resolved from i18n at render time — see OrderTracker below.
const STEP_KEYS = ["pending", "accepted", "preparing", "ready", "delivered"] as const;

function OrderTracker({ order }: { order: Order }) {
  const tSteps = useTranslations("guest.order.steps");
  const currentIndex = (ORDER_FLOW as readonly string[]).indexOf(order.status);
  if (order.status === "cancelled") return null;
  return (
    <div className="flex items-end">
      {ORDER_FLOW.map((step, i) => {
        const done = i <= currentIndex;
        return (
          <div key={step} className="flex items-end [&:not(:last-child)]:flex-1">
            <div className="flex flex-1 flex-col items-center gap-1">
              <div
                key={`${step}-${order.status}`}
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                  done
                    ? "border-primary bg-primary text-primary-foreground animate-pop-in"
                    : "border-border bg-card text-muted-foreground",
                  i === currentIndex && "animate-pulse glow-primary",
                )}
              >
                {done && i < currentIndex ? <Check className="size-3" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-[10px]",
                  i === currentIndex ? "font-semibold text-primary" : "text-muted-foreground",
                )}
              >
                {tSteps(step)}
              </span>
            </div>
            {i < ORDER_FLOW.length - 1 && (
              <div
                className={cn(
                  "flex-1 self-center",
                  i < currentIndex
                    ? "order-connector h-0.5 w-full bg-primary"
                    : "h-0.5 w-0 bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function GuestOrdersPage() {
  const t = useTranslations("guest.order");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { guestName, sessionId, closureStatus, setClosureStatus } = useGuest();

  const { data: summary } = useQuery({
    queryKey: ["analytics-summary"] as const,
    queryFn: () => analyticsService.getSummary(),
    enabled: isDemoMode(),
  });
  const avgFulfillmentMinutes = summary?.avgFulfillmentMinutes ?? 8;

  const { data: orders = [], isPending: ordersLoading } = useQuery({
    queryKey: guestOrderKeys.list(guestName ?? ""),
    queryFn: async () => {
      if (!guestName) return [] as Order[];
      const result = await ordersService.listGuestOrders(guestName);
      // While waiting for the host to close the tab, watch the session status.
      if (closureStatus === "requested" && sessionId) {
        const session = await guestsService.getSession(sessionId);
        if (session?.status === "closed") setClosureStatus("closed");
      }
      return result;
    },
    enabled: !!guestName,
  });

  // SSE + polling integration: invalidate query on events
  const invalidate = useCallback(() => {
    if (guestName) {
      queryClient.invalidateQueries({ queryKey: guestOrderKeys.list(guestName) });
    }
  }, [guestName, queryClient]);

  useLiveEvents({
    scope: "guest",
    sessionId: sessionId ?? undefined,
    onEvent: () => invalidate(),
    fallbackMs: 5000,
    fallbackRefresh: () => invalidate(),
  });

  useEffect(() => {
    if (closureStatus === "closed") router.push("/guest/receipt");
  }, [closureStatus, router]);

  const requestClosureMutation = useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error("No session");
      await guestsService.requestClosure(sessionId);
    },
    onSuccess: () => {
      setClosureStatus("requested");
      toast.success("Closure requested — your host will confirm shortly.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not request tab closure");
    },
  });

  const simulateApproveMutation = useMutation({
    mutationFn: async () => {
      if (!sessionId) throw new Error("No session");
      await guestsService.setSessionStatus(sessionId, "closed");
    },
    onSuccess: () => {
      setClosureStatus("closed");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not close the demo session");
    },
  });

  const simulateProgressMutation = useMutation({
    mutationFn: async () => {
      const active = orders.find((o) => !["delivered", "cancelled"].includes(o.status));
      if (!active) throw new Error("No active order");
      await ordersService.advanceOrder(active.id);
    },
    onSuccess: () => {
      invalidate();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not advance the demo order");
    },
  });

  if (ordersLoading) {
    return (
      <div className="p-4">
        <ListSkeleton rows={2} rowHeight="h-40" />
      </div>
    );
  }

  const hasActive = orders.some((o) => !["delivered", "cancelled"].includes(o.status));
  const delivered = orders.filter((o) => o.status === "delivered");
  const canRequestClosure =
    delivered.length > 0 && !hasActive && sessionId !== null && closureStatus === "none";

  return (
    <div className="space-y-4 p-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-display text-xl">{t("title")}</h1>
        {hasActive && <DemoOrderProgressControl busy={simulateProgressMutation.isPending} onProgress={() => simulateProgressMutation.mutate()} />}
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={t("noOrders")}
          description={t("noOrdersDesc")}
          action={
            <Button asChild>
              <Link href="/guest/menu">{t("title")}</Link>
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
                    {order.items.reduce((n, i) => n + i.quantity, 0)} items
                  </p>
                  {order.promotionCode && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-primary">
                      <Tag className="size-3" /> {order.promotionCode}
                      {order.promotionCents ? ` (−${formatMoney(order.promotionCents / 100)})` : ""}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div key={`${order.id}-${order.status}`}><StatusBadge status={order.status} pulse={order.status === "pending"} /></div>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatMoney(order.total)}
                  </span>
                </div>
              </div>

              {(() => {
                const etaMinutes = estimateEtaMinutes(order, avgFulfillmentMinutes);
                const eta = formatEta(etaMinutes);
                const isImminent = etaMinutes !== null && etaMinutes <= 5;
                return eta ? (
                  <p className={cn(
                    "flex items-center gap-1 text-xs font-medium",
                    isImminent ? "text-primary animate-glow-pulse" : "text-primary",
                  )}>
                    <Clock className="size-3" />
                    {eta}
                  </p>
                ) : null;
              })()}

              <OrderTracker order={order} />

              {order.status === "delivered" && (
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href={`/guest/receipt?order=${order.id}`}>
                    <ReceiptText className="size-4" /> {t("viewReceipt")}
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
              <p className="font-semibold">
                {delivered.length} {delivered.length === 1 ? "order" : "orders"} delivered
              </p>
              <p className="text-sm text-muted-foreground">
                Ready to head out? Ask your host to close the tab and get your night&apos;s
                receipt.
              </p>
            </div>
            <Button
              size="lg"
              className="h-12 w-full glow-primary"
              onClick={() => requestClosureMutation.mutate()}
              disabled={requestClosureMutation.isPending}
            >
              {requestClosureMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {requestClosureMutation.isPending ? "Requesting…" : "Request to close my tab"}
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
            <DemoClosureApprovalControl busy={simulateApproveMutation.isPending} onApprove={() => simulateApproveMutation.mutate()} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
