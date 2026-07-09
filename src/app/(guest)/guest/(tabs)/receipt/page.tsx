"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Moon, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { CountUp } from "@/components/fx/count-up";
import { useGuest } from "@/context/guest-context";
import { mockOrdersService } from "@/lib/mock-services/orders-service";
import { formatMoney, formatTime } from "@/lib/format";
import { mockVenue } from "@/lib/mock-data/venue";
import type { Order } from "@/lib/types";

function OrderLines({ order }: { order: Order }) {
  return (
    <ul className="space-y-2 text-sm">
      {order.items.map((item) => {
        const modTotal = item.modifiers.reduce((s, m) => s + m.priceDelta, 0);
        return (
          <li key={item.id}>
            <div className="flex justify-between">
              <span>
                {item.quantity}× {item.name}
              </span>
              <span className="tabular-nums">
                {formatMoney((item.unitPrice + modTotal) * item.quantity)}
              </span>
            </div>
            {item.modifiers.map((mod) => (
              <p key={mod.optionName} className="pl-4 text-xs text-muted-foreground">
                + {mod.optionName}
                {mod.priceDelta > 0 && ` (${formatMoney(mod.priceDelta)})`}
              </p>
            ))}
          </li>
        );
      })}
    </ul>
  );
}

function Totals({ subtotal, serviceFee, tip, total }: {
  subtotal: number;
  serviceFee: number;
  tip: number;
  total: number;
}) {
  return (
    <div className="space-y-1 text-sm">
      <div className="flex justify-between text-muted-foreground">
        <span>Subtotal</span>
        <span className="tabular-nums">{formatMoney(subtotal)}</span>
      </div>
      <div className="flex justify-between text-muted-foreground">
        <span>Service fee</span>
        <span className="tabular-nums">{formatMoney(serviceFee)}</span>
      </div>
      <div className="flex justify-between text-muted-foreground">
        <span>Tips</span>
        <span className="tabular-nums">{formatMoney(tip)}</span>
      </div>
      <div className="flex justify-between pt-1 text-base font-semibold">
        <span>Total</span>
        <CountUp value={total} format={formatMoney} duration={1.2} className="tabular-nums" />
      </div>
    </div>
  );
}

function VenueHeader({ tableCode, zoneName }: { tableCode?: string; zoneName?: string }) {
  return (
    <div className="text-center">
      <p className="font-semibold">{mockVenue.name}</p>
      <p className="text-xs text-muted-foreground">
        {mockVenue.address}, {mockVenue.city}
      </p>
      {tableCode && (
        <p className="text-xs text-muted-foreground">
          Table {tableCode}
          {zoneName && ` · ${zoneName}`}
        </p>
      )}
    </div>
  );
}

/** Full-night receipt shown after the host approves the tab closure. */
function NightReceipt() {
  const { guestName, table } = useGuest();
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    mockOrdersService.listGuestOrders(guestName).then((result) => {
      if (!cancelled) setOrders(result.filter((o) => o.status === "delivered"));
    });
    return () => {
      cancelled = true;
    };
  }, [guestName]);

  if (orders === null) return <ListSkeleton rows={1} rowHeight="h-96" />;

  const subtotal = orders.reduce((s, o) => s + o.subtotal, 0);
  const serviceFee = orders.reduce((s, o) => s + o.serviceFee, 0);
  const tip = orders.reduce((s, o) => s + o.tip, 0);
  const total = orders.reduce((s, o) => s + o.total, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-2 py-4 text-center animate-pop-in">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/15 glow-primary">
          <Moon className="size-8 text-primary" />
        </div>
        <h1 className="text-xl font-semibold">Tab closed — thanks for the night!</h1>
        <p className="text-sm text-muted-foreground">
          {guestName}, here&apos;s everything from tonight.
        </p>
      </div>

      <Card className="animate-fade-up">
        <CardContent className="space-y-4">
          <VenueHeader tableCode={table?.tableCode} zoneName={table?.zoneName} />
          <Separator />

          {orders.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              No delivered orders on this tab.
            </p>
          ) : (
            <div className="space-y-4 stagger-children">
              {orders.map((order) => (
                <div key={order.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-xs font-semibold text-primary">
                      {order.code} · {formatTime(order.placedAt)}
                    </p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {formatMoney(order.total)}
                    </p>
                  </div>
                  <OrderLines order={order} />
                  <Separator />
                </div>
              ))}
            </div>
          )}

          <Totals subtotal={subtotal} serviceFee={serviceFee} tip={tip} total={total} />

          <Separator />
          <p className="text-center text-xs text-muted-foreground">
            {/* TODO(backend): settle payment (Stripe) + email the receipt on closure. */}
            Demo receipt — no payment was processed.
          </p>
        </CardContent>
      </Card>

      <Button variant="outline" className="w-full animate-fade-up" asChild>
        <Link href="/g/demo-table">Start a new session</Link>
      </Button>
    </div>
  );
}

/** Single-order receipt (linked from a delivered order card). */
function SingleOrderReceipt({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    mockOrdersService.getOrder(orderId).then((result) => {
      if (!cancelled) {
        setOrder(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (loading) return <ListSkeleton rows={1} rowHeight="h-96" />;

  if (!order) {
    return (
      <EmptyState
        icon={ReceiptText}
        title="No receipt to show"
        description="Place an order first — your receipt will appear here."
        action={
          <Button asChild>
            <Link href="/guest/menu">Browse menu</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-2 py-4 text-center animate-pop-in">
        <CheckCircle2 className="size-10 text-emerald-600 dark:text-emerald-400" />
        <h1 className="text-xl font-semibold">Thanks for the night!</h1>
        <p className="text-sm text-muted-foreground">
          Order {order.code} · {formatTime(order.placedAt)}
        </p>
      </div>

      <Card className="animate-fade-up">
        <CardContent className="space-y-3">
          <VenueHeader tableCode={order.tableCode} zoneName={order.zoneName} />
          <Separator />
          <OrderLines order={order} />
          <Separator />
          <Totals
            subtotal={order.subtotal}
            serviceFee={order.serviceFee}
            tip={order.tip}
            total={order.total}
          />
          <Separator />
          <p className="text-center text-xs text-muted-foreground">
            Demo receipt — no payment was processed.
          </p>
        </CardContent>
      </Card>

      <Button variant="outline" className="w-full animate-fade-up" asChild>
        <Link href="/guest/menu">Order something else</Link>
      </Button>
    </div>
  );
}

function ReceiptContent() {
  const searchParams = useSearchParams();
  const { lastOrderId, closureStatus } = useGuest();
  const orderId = searchParams.get("order");

  if (orderId) return <SingleOrderReceipt orderId={orderId} />;
  if (closureStatus === "closed") return <NightReceipt />;
  if (lastOrderId) return <SingleOrderReceipt orderId={lastOrderId} />;

  return (
    <EmptyState
      icon={ReceiptText}
      title="No receipt to show"
      description="Place an order first — your receipt will appear here."
      action={
        <Button asChild>
          <Link href="/guest/menu">Browse menu</Link>
        </Button>
      }
    />
  );
}

export default function GuestReceiptPage() {
  return (
    <div className="p-4 animate-fade-in">
      <Suspense fallback={<ListSkeleton rows={1} rowHeight="h-96" />}>
        <ReceiptContent />
      </Suspense>
    </div>
  );
}
