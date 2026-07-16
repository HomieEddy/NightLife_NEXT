"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Minus, Plus, ShoppingBag, Tag, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { BottleIcon } from "@/components/shared/bottle-icon";
import { AnimatedMoney } from "@/components/fx/animated-money";
import { useGuest } from "@/context/guest-context";
import { menuService } from "@/lib/services/menu-service";
import { ordersService } from "@/lib/services/orders-service";
import { promotionsService } from "@/lib/services/promotions-service";
import { computeFeeLines, feeLabel } from "@/lib/fees";
import { bestHappyHourDiscount } from "@/lib/happy-hour";
import { formatMoney } from "@/lib/format";
import { useLastCall } from "@/lib/use-last-call";
import { cn } from "@/lib/utils";
import { orderLineSubtotal } from "@/lib/order-line";
import type { HappyHourRule, Promotion } from "@/lib/types";

const TIP_PRESETS = [0, 10, 15, 20] as const;

/** Cart line list + tip selector + submit. Shared by the bottom sheet and /guest/cart. */
export function CartContents({ onSubmitted }: { onSubmitted?: () => void }) {
  const router = useRouter();
  const {
    table,
    venue,
    guestName,
    sessionId,
    cart,
    cartSubtotal,
    updateQuantity,
    removeLine,
    clearCart,
    setLastOrderId,
  } = useGuest();
  const [tipPct, setTipPct] = useState<number>(10);
  const [submitting, setSubmitting] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<Promotion | null>(null);
  const [happyHourRules, setHappyHourRules] = useState<HappyHourRule[]>([]);
  const lastCallActive = useLastCall();

  useEffect(() => {
    menuService.listHappyHourRules().then(setHappyHourRules);
  }, []);

  // Preview of the discount the order service will apply — same rule selection.
  const happyHourDiscount = useMemo(() => {
    const now = new Date();
    let discount = 0;
    for (const line of cart) {
      const best = bestHappyHourDiscount(happyHourRules, line.menuItem.categoryId ?? "packages", now);
      if (!best) continue;
      const lineTotal = orderLineSubtotal(line.menuItem.price, line.quantity, line.modifiers);
      discount += Math.round(lineTotal * best.discountPct) / 100;
    }
    return Math.round(discount * 100) / 100;
  }, [cart, happyHourRules]);

  const promoDiscount = useMemo(() => {
    if (!appliedPromo) return 0;
    if (appliedPromo.type === "percentage") {
      return Math.round(cartSubtotal * appliedPromo.value) / 100;
    }
    return Math.min(appliedPromo.value, cartSubtotal);
  }, [appliedPromo, cartSubtotal]);

  const afterDiscounts = cartSubtotal - happyHourDiscount - promoDiscount;

  // Snapshot taken at QR landing (see findTableByQrSlug) — fee edits made mid-session
  // won't retroactively apply to an already-open guest cart.
  const feeLines = useMemo(
    () => (venue ? computeFeeLines(afterDiscounts, venue) : []),
    [afterDiscounts, venue],
  );
  const serviceFee = useMemo(
    () => Math.round(feeLines.reduce((sum, l) => sum + l.amount, 0) * 100) / 100,
    [feeLines],
  );
  const tip = useMemo(() => Math.round(cartSubtotal * tipPct) / 100, [cartSubtotal, tipPct]);
  const total = afterDiscounts + serviceFee + tip;

  async function handleApplyPromo() {
    if (!promoInput.trim()) return;
    setPromoLoading(true);
    try {
      const promo = await promotionsService.validateCode(promoInput);
      if (!promo) {
        toast.error("Invalid or expired promo code");
        return;
      }
      setAppliedPromo(promo);
      setPromoInput("");
      toast.success(`${promo.name} applied!`);
    } catch {
      toast.error("Could not validate promo code");
    } finally {
      setPromoLoading(false);
    }
  }

  async function handleSubmit() {
    if (!table) return;
    setSubmitting(true);
    try {
      const order = await ordersService.submitOrder({
        tableId: table.tableId,
        tableCode: table.tableCode,
        zoneId: table.zoneId,
        zoneName: table.zoneName,
        guestName,
        sessionId: sessionId ?? undefined,
        lines: cart,
        tip,
        promoCode: appliedPromo?.code,
        promoDiscount: promoDiscount || undefined,
        promoId: appliedPromo?.id,
      });
      setLastOrderId(order.id);
      clearCart();
      toast.success(`Order ${order.code} sent to the team!`);
      onSubmitted?.();
      router.push("/guest/orders");
    } catch {
      toast.error("Could not submit your order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (cart.length === 0) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Your cart is empty"
        description="Add something from the menu to get the night started."
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
      <ul className="space-y-3 stagger-children">
        {cart.map((line) => {
          return (
            <li key={line.lineId} className="flex gap-3 rounded-xl border p-3">
              <BottleIcon icon={line.menuItem.icon} className="size-11" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-medium">{line.menuItem.name}</p>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatMoney(orderLineSubtotal(line.menuItem.price, line.quantity, line.modifiers))}
                  </p>
                </div>
                {line.modifiers.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {line.modifiers.map((modifier) => `${modifier.quantity}× ${modifier.optionName}`).join(", ")}
                  </p>
                )}
                {line.note && <p className="text-xs italic text-muted-foreground">“{line.note}”</p>}
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1 rounded-md border">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => updateQuantity(line.lineId, line.quantity - 1)}
                      aria-label="Decrease"
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="w-6 text-center text-sm font-medium tabular-nums">
                      {line.quantity}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => updateQuantity(line.lineId, line.quantity + 1)}
                      aria-label="Increase"
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                  <ConfirmDialog
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                        aria-label="Remove item"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    }
                    title={`Remove ${line.menuItem.name}?`}
                    description="It comes out of your cart — you can always add it back from the menu."
                    confirmLabel="Remove"
                    destructive
                    onConfirm={() => removeLine(line.lineId)}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="space-y-2">
        <p className="text-sm font-medium">Add a tip for the team</p>
        <div className="grid grid-cols-4 gap-2">
          {TIP_PRESETS.map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => setTipPct(pct)}
              className={cn(
                "rounded-lg border py-2.5 text-sm font-semibold transition-colors",
                tipPct === pct
                  ? "border-primary bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {pct === 0 ? "None" : `${pct}%`}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Promo code</p>
        {appliedPromo ? (
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
            <Tag className="size-4 text-primary" />
            <span className="flex-1 text-sm font-medium">{appliedPromo.code}</span>
            <span className="text-sm text-primary tabular-nums">-{formatMoney(promoDiscount)}</span>
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={() => setAppliedPromo(null)}
              aria-label="Remove promo code"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value)}
              placeholder="Enter code"
              className="h-9 uppercase"
              onKeyDown={(e) => e.key === "Enter" && handleApplyPromo()}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={handleApplyPromo}
              disabled={promoLoading || !promoInput.trim()}
            >
              {promoLoading ? <Loader2 className="size-4 animate-spin" /> : "Apply"}
            </Button>
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatMoney(cartSubtotal)}</span>
        </div>
        {happyHourDiscount > 0 && (
          <div className="flex justify-between text-primary">
            <span>Happy hour</span>
            <span className="tabular-nums">-{formatMoney(happyHourDiscount)}</span>
          </div>
        )}
        {promoDiscount > 0 && (
          <div className="flex justify-between text-primary">
            <span>{appliedPromo?.name ?? "Promo"}</span>
            <span className="tabular-nums">-{formatMoney(promoDiscount)}</span>
          </div>
        )}
        {feeLines.map((line) => (
          <div key={line.fee.id} className="flex justify-between text-muted-foreground">
            <span>
              {line.fee.name} ({feeLabel(line.fee)})
            </span>
            <span className="tabular-nums">{formatMoney(line.amount)}</span>
          </div>
        ))}
        <div className="flex justify-between text-muted-foreground">
          <span>Tip</span>
          <AnimatedMoney value={tip} />
        </div>
        <div className="flex justify-between pt-1 text-base font-semibold">
          <span>Total</span>
          <AnimatedMoney value={total} />
        </div>
      </div>

      {lastCallActive && (
        <p className="text-center text-sm text-muted-foreground">
          Kitchen&apos;s closed for the night — thanks for being here! You can still browse your
          order history below.
        </p>
      )}

      {/* TODO(backend): payment step (Stripe) goes here before submission. */}
      <ConfirmDialog
        title="Place this order?"
        description={`${formatMoney(total)} total including fees and tip — the bar starts on it right away.`}
        confirmLabel={`Place order · ${formatMoney(total)}`}
        onConfirm={handleSubmit}
        trigger={
      <Button size="lg" className="h-12 w-full glow-primary" disabled={submitting || lastCallActive}>
        {submitting && <Loader2 className="size-4 animate-spin" />}
        {submitting
          ? "Sending order…"
          : lastCallActive
            ? "Last call — ordering closed"
            : `Place order · ${formatMoney(total)}`}
      </Button>
        }
      />
    </div>
  );
}
