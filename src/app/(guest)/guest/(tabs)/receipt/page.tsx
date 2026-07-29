"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ChevronDown, Mail, Minus, Moon, Plus, ReceiptText, Tag, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/shared/empty-state";
import { DemoNewSessionAction } from "@/components/shared/demo-links";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { CountUp } from "@/components/fx/count-up";
import { useGuest } from "@/context/guest-context";
import { ordersService } from "@/features/ordering/services";
import { guestsService } from "@/features/guests/services";
import { formatDate, formatMoney, formatTime } from "@/features/shared/format";
import { cn } from "@/features/shared/utils";
import { evenShares, summarizeReceipt } from "@/lib/receipt";
import { computeSessionBalance } from "@/lib/tab";
import type { Order, TabAdjustment, Venue } from "@/lib/types";
import { isDemoMode } from "@/features/shared/app-mode";

function OrderLines({ order }: { order: Order }) {
  return (
    <ul className="space-y-2 text-sm">
      {order.items.map((item) => {
        return (
          <li key={item.id}>
            <div className="flex justify-between">
              <span>
                {item.quantity}× {item.name}
              </span>
              <span className="tabular-nums">
                {formatMoney(item.unitPrice * item.quantity)}
              </span>
            </div>
            {item.modifiers.length > 0 && (
              <ul className="pl-4 space-y-0.5 text-xs text-muted-foreground">
                {item.modifiers.map((mod, i) => (
                  <li key={i} className="flex justify-between">
                    <span>• {mod.quantity}× {mod.optionName}</span>
                    {mod.priceDelta > 0 && <span className="tabular-nums">{formatMoney(mod.priceDelta * mod.quantity)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Totals({ subtotal, feeBreakdown, tip, total, promotionCode, promotionCents }: {
  subtotal: number;
  feeBreakdown?: { fee: { name: string; type: "percentage" | "flat"; value: number }; amount: number }[];
  tip: number;
  total: number;
  promotionCode?: string;
  promotionCents?: number;
}) {
  return (
    <div className="space-y-1 text-sm">
      <div className="flex justify-between text-muted-foreground">
        <span>Subtotal</span>
        <span className="tabular-nums">{formatMoney(subtotal)}</span>
      </div>
      {promotionCode && promotionCents ? (
        <div className="flex justify-between text-primary">
          <span className="flex items-center gap-1">
            <Tag className="size-3" /> {promotionCode}
          </span>
          <span className="tabular-nums">−{formatMoney(promotionCents / 100)}</span>
        </div>
      ) : null}
      {(feeBreakdown ?? []).map((line) => (
        <div key={line.fee.name} className="flex justify-between text-muted-foreground">
          <span>{line.fee.name} {line.fee.type === "percentage" ? `(${line.fee.value}%)` : ""}</span>
          <span className="tabular-nums">{formatMoney(line.amount)}</span>
        </div>
      ))}
      <div className="flex justify-between text-muted-foreground">
        <span>Tips</span>
        <span className="tabular-nums">{formatMoney(tip)}</span>
      </div>
      <div className="flex justify-between pt-1 text-base font-semibold">
        <span>Total</span>
        <CountUp value={total} format={formatMoney} duration={1.2} startOnMount className="tabular-nums" />
      </div>
    </div>
  );
}

function VenueHeader({
  venue,
  tableCode,
  zoneName,
}: {
  venue: Venue | null;
  tableCode?: string;
  zoneName?: string;
}) {
  return (
    <div className="text-center">
      <p className="font-semibold">{venue?.name}</p>
      <p className="text-xs text-muted-foreground">
        {venue?.address}, {venue?.city}
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

interface CustomShare {
  id: string;
  name: string;
  amount: number;
}

/** Even or custom (uneven) split calculator — collapsed behind a toggle. */
function SplitBill({ total }: { total: number }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"even" | "custom">("even");
  const [people, setPeople] = useState(2);
  const [shares, setShares] = useState<CustomShare[]>(() =>
    evenShares(total, 2).map((amount, i) => ({ id: `share-${i}`, name: "", amount })),
  );

  const perPerson = total / people;
  const assigned = Math.round(shares.reduce((s, x) => s + x.amount, 0) * 100) / 100;
  const remaining = Math.round((total - assigned) * 100) / 100;

  function resplitEvenly(count: number) {
    setShares((prev) =>
      evenShares(total, count).map((amount, i) => ({
        id: prev[i]?.id ?? `share-${i}`,
        name: prev[i]?.name ?? "",
        amount,
      })),
    );
  }

  function addShare() {
    setShares((prev) => [...prev, { id: `share-${Date.now()}`, name: "", amount: 0 }]);
  }

  function removeShare(id: string) {
    setShares((prev) => (prev.length > 2 ? prev.filter((s) => s.id !== id) : prev));
  }

  function patchShare(id: string, patch: Partial<CustomShare>) {
    setShares((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between"
        >
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Users className="size-4 text-primary" /> Split the bill
          </span>
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>

        {open && (
          <div className="space-y-3 pt-1">
            <div className="flex gap-1.5">
              {(
                [
                  { id: "even", label: "Split evenly" },
                  { id: "custom", label: "Custom amounts" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setMode(opt.id);
                    if (opt.id === "custom") resplitEvenly(people);
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    mode === opt.id
                      ? "border-primary bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {mode === "even" ? (
              <>
                <div className="flex items-center justify-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPeople((p) => Math.max(2, p - 1))}
                    aria-label="Fewer people"
                  >
                    <Minus className="size-4" />
                  </Button>
                  <span className="w-10 text-center text-2xl font-bold tabular-nums">{people}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPeople((p) => Math.min(8, p + 1))}
                    aria-label="More people"
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
                <p className="text-center text-xs text-muted-foreground">people splitting evenly</p>
                <div className="rounded-lg bg-accent/50 p-3 text-center">
                  <p className="text-2xl font-bold tabular-nums">{formatMoney(perPerson)}</p>
                  <p className="text-xs text-muted-foreground">per person</p>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  {shares.map((share, i) => (
                    <div key={share.id} className="flex items-center gap-2">
                      <Input
                        placeholder={`Guest ${i + 1}`}
                        value={share.name}
                        onChange={(e) => patchShare(share.id, { name: e.target.value })}
                        className="flex-1"
                        aria-label="Name (optional)"
                      />
                      <div className="relative w-28 shrink-0">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          $
                        </span>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={share.amount}
                          onChange={(e) =>
                            patchShare(share.id, { amount: Math.max(0, Number(e.target.value)) })
                          }
                          className="pl-5 tabular-nums"
                          aria-label="Amount"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                        aria-label="Remove person"
                        disabled={shares.length <= 2}
                        onClick={() => removeShare(share.id)}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <Button variant="outline" size="sm" onClick={addShare}>
                    <Plus className="size-3.5" /> Add person
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => resplitEvenly(shares.length)}>
                    Reset to even
                  </Button>
                </div>
                <div
                  className={cn(
                    "rounded-lg p-3 text-center text-sm",
                    remaining === 0
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                  )}
                >
                  {remaining === 0 ? (
                    <span className="font-medium">Fully assigned — {formatMoney(total)}</span>
                  ) : remaining > 0 ? (
                    <span className="font-medium">{formatMoney(remaining)} still unassigned</span>
                  ) : (
                    <span className="font-medium">
                      {formatMoney(Math.abs(remaining))} over the total
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Full-night receipt shown after the host approves the tab closure. */
function NightReceipt() {
  const { guestName, table, venue, sessionId } = useGuest();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [adjustments, setAdjustments] = useState<TabAdjustment[]>([]);
  const [minimumSpendCents, setMinimumSpendCents] = useState(0);
  const [email, setEmail] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = sessionId
      ? ordersService.listOrdersBySession(sessionId)
      : ordersService.listGuestOrders(guestName);
    load.then((result) => {
      if (!cancelled) setOrders(result.filter((o) => o.status === "delivered"));
    });
    if (sessionId) {
      ordersService.listAdjustments(sessionId).then((result) => {
        if (!cancelled) setAdjustments(result);
      });
      guestsService.getSession(sessionId).then((session) => {
        if (!cancelled) setMinimumSpendCents(session?.minimumSpendCents ?? 0);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [guestName, sessionId]);

  function sendEmail() {
    if (!email.trim()) return toast.error("Enter an email address.");
    toast.success(`Receipt sent to ${email.trim()} (demo)`);
  }

  if (orders === null) return <ListSkeleton rows={1} rowHeight="h-96" />;

  const { subtotal, tip, total, promoCents, feeLines } = summarizeReceipt(orders);
  const firstAt = orders[0]?.placedAt;
  const balance = sessionId
    ? computeSessionBalance(sessionId, orders, adjustments, minimumSpendCents)
    : null;
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-2 py-4 text-center animate-pop-in">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary/15 glow-primary">
          <Moon className="size-8 text-primary" />
        </div>
        <h1 className="text-display text-xl">Tab closed — thanks for the night!</h1>
        <p className="text-sm text-muted-foreground">
          {guestName}, here&apos;s everything from tonight.
        </p>
      </div>

      {/* Paper receipt */}
      <div className="mx-auto w-full max-w-sm rounded-lg bg-zinc-50 text-zinc-900 shadow-xl animate-fade-up" style={{ animationDelay: "450ms" }}>
        <div className="space-y-2 p-5 font-mono text-xs leading-relaxed">
          <div className="text-center">
            <p className="text-sm font-bold tracking-[0.2em]">{venue?.name.toUpperCase()}</p>
            <p>
              {venue?.address}, {venue?.city}
            </p>
            <div className="my-2 border-y border-dashed border-zinc-400 py-1 font-semibold tracking-widest">
              GUEST RECEIPT
            </div>
          </div>

          <div className="flex justify-between">
            <span>TABLE</span>
            <span>
              {table?.tableCode ?? "—"}
              {table?.zoneName ? ` · ${table.zoneName}` : ""}
            </span>
          </div>
          <div className="flex justify-between">
            <span>GUEST</span>
            <span>{guestName}</span>
          </div>
          {firstAt && (
            <div className="flex justify-between">
              <span>DATE</span>
              <span>
                {formatDate(firstAt)} {formatTime(firstAt)}
              </span>
            </div>
          )}

          <div className="border-t border-dashed border-zinc-400" />

          {orders.map((order) => (
            <div key={order.id} className="space-y-1">
              <div className="flex justify-between font-semibold">
                <span>{order.code}</span>
                <span>{formatTime(order.placedAt)}</span>
              </div>
              {order.items.map((item) => {
                return (
                  <div key={item.id} className="space-y-0.5">
                    <div className="flex justify-between gap-2">
                      <span className="truncate">
                        {item.quantity}× {item.name}
                      </span>
                      <span className="whitespace-nowrap tabular-nums">
                        {formatMoney(item.unitPrice * item.quantity)}
                      </span>
                    </div>
                    {item.modifiers.length > 0 && (
                      <ul className="pl-3 space-y-0.5 text-[11px] text-muted-foreground">
                        {item.modifiers.map((m, i) => (
                          <li key={i} className="flex justify-between">
                            <span>• {m.quantity}× {m.optionName}</span>
                            {m.priceDelta > 0 && <span className="tabular-nums">{formatMoney(m.priceDelta * m.quantity)}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
              {order.promotionCode && order.promotionCents ? (
                <div className="flex justify-between text-[10px] text-zinc-500">
                  <span>PROMO {order.promotionCode}</span>
                  <span className="tabular-nums">−{formatMoney(order.promotionCents / 100)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-[10px] text-zinc-500">
                <span>served</span>
                <span className="tabular-nums">{formatMoney(order.total)}</span>
              </div>
              <div className="border-t border-dashed border-zinc-300" />
            </div>
          ))}

          <div className="space-y-0.5 pt-1">
            <div className="flex justify-between">
              <span>SUBTOTAL</span>
              <span className="tabular-nums">{formatMoney(subtotal)}</span>
            </div>
            {promoCents > 0 && (
              <div className="flex justify-between text-zinc-600">
                <span>PROMO DISCOUNT</span>
                <span className="tabular-nums">−{formatMoney(promoCents / 100)}</span>
              </div>
            )}
            {feeLines.map((line) => (
              <div key={line.name} className="flex justify-between text-zinc-600">
                <span>{line.name.toUpperCase()} {line.type === "percentage" ? `(${line.value}%)` : "(flat)"}</span>
                <span className="tabular-nums">{formatMoney(line.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between">
              <span>TIP</span>
              <span className="tabular-nums">{formatMoney(tip)}</span>
            </div>
            {balance && balance.voidCents > 0 && (
              <div className="flex justify-between text-zinc-600">
                <span>VOID</span>
                <span className="tabular-nums">−{formatMoney(balance.voidCents / 100)}</span>
              </div>
            )}
            {balance && balance.compCents > 0 && (
              <div className="flex justify-between text-zinc-600">
                <span>COMP</span>
                <span className="tabular-nums">−{formatMoney(balance.compCents / 100)}</span>
              </div>
            )}
            {balance && balance.discountCents > 0 && (
              <div className="flex justify-between text-zinc-600">
                <span>DISCOUNT</span>
                <span className="tabular-nums">−{formatMoney(balance.discountCents / 100)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-dashed border-zinc-400 pt-1 text-sm font-bold">
              <span>{balance && balance.adjustmentsCents > 0 ? "GROSS TOTAL" : "TOTAL"}</span>
              <span className="tabular-nums">{formatMoney(total)}</span>
            </div>
            {balance && balance.adjustmentsCents > 0 && (
              <div className="flex justify-between text-sm font-bold">
                <span>NET TOTAL</span>
                <span className="tabular-nums">{formatMoney(balance.netCents / 100)}</span>
              </div>
            )}
            {balance && balance.shortfallCents > 0 && (
              <div className="flex justify-between text-zinc-600">
                <span>MINIMUM SPEND SHORTFALL</span>
                <span className="tabular-nums">{formatMoney(balance.shortfallCents / 100)}</span>
              </div>
            )}
          </div>

          <p className="text-center text-[10px] text-zinc-500">
            {isDemoMode() ? "DEMO RECEIPT · NO PAYMENT PROCESSED" : "EXTERNAL SETTLEMENT RECEIPT"}
          </p>
          <p className="text-center text-[10px] text-zinc-500">THANK YOU · COME AGAIN</p>
        </div>
      </div>

      <div className="animate-fade-up" style={{ animationDelay: "650ms" }}>
        <SplitBill total={total} />
      </div>

      {/* Dummy email-the-receipt action */}
      <div className="space-y-2 animate-fade-up" style={{ animationDelay: "850ms" }}>
        <Input
          type="email"
          placeholder="guest@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button onClick={sendEmail} className="w-full">
          <Mail className="size-4" /> Email receipt
        </Button>
      </div>

      <div className="animate-fade-up" style={{ animationDelay: "850ms" }}>
        <DemoNewSessionAction />
      </div>
    </div>
  );
}

/** Single-order receipt (linked from a delivered order card). */
function SingleOrderReceipt({ orderId }: { orderId: string }) {
  const { venue } = useGuest();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    ordersService.getOrder(orderId).then((result) => {
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
        <h1 className="text-display text-xl">Thanks for the night!</h1>
        <p className="text-sm text-muted-foreground">
          Order {order.code} · {formatTime(order.placedAt)}
        </p>
      </div>

      <Card className="animate-fade-up">
        <CardContent className="space-y-3">
          <VenueHeader venue={venue} tableCode={order.tableCode} zoneName={order.zoneName} />
          <Separator />
          <OrderLines order={order} />
          <Separator />
          <Totals
            subtotal={order.subtotal}
            feeBreakdown={order.feeBreakdown}
            tip={order.tip}
            total={order.total}
            promotionCode={order.promotionCode}
            promotionCents={order.promotionCents}
          />
          <Separator />
          <p className="text-center text-xs text-muted-foreground">
            {isDemoMode() ? "Demo receipt — no payment was processed." : "Settled externally with venue staff."}
          </p>
        </CardContent>
      </Card>

      <div className="flex gap-2 animate-fade-up">
        <Button variant="outline" className="flex-1" asChild>
          <Link href="/guest/orders">My orders</Link>
        </Button>
        <Button variant="outline" className="flex-1" asChild>
          <Link href="/guest/menu">Order something else</Link>
        </Button>
      </div>
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
