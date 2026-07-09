"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { BottleIcon } from "@/components/shared/bottle-icon";
import { AnimatedMoney } from "@/components/fx/animated-money";
import { useGuest } from "@/context/guest-context";
import { mockOrdersService } from "@/lib/mock-services/orders-service";
import { mockVenueService } from "@/lib/mock-services/venue-service";
import { computeFeeLines, feeLabel } from "@/lib/fees";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const TIP_PRESETS = [0, 10, 15, 20] as const;

/** Cart line list + tip selector + submit. Shared by the bottom sheet and /guest/cart. */
export function CartContents({ onSubmitted }: { onSubmitted?: () => void }) {
  const router = useRouter();
  const {
    table,
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

  // Live settings snapshot, so manager fee edits show up in the guest cart.
  const feeLines = useMemo(
    () => computeFeeLines(cartSubtotal, mockVenueService.getVenueSnapshot()),
    [cartSubtotal],
  );
  const serviceFee = useMemo(
    () => Math.round(feeLines.reduce((sum, l) => sum + l.amount, 0) * 100) / 100,
    [feeLines],
  );
  const tip = useMemo(() => Math.round(cartSubtotal * tipPct) / 100, [cartSubtotal, tipPct]);
  const total = cartSubtotal + serviceFee + tip;

  async function handleSubmit() {
    if (!table) return;
    setSubmitting(true);
    try {
      const order = await mockOrdersService.submitOrder({
        tableId: table.tableId,
        tableCode: table.tableCode,
        zoneId: table.zoneId,
        zoneName: table.zoneName,
        guestName,
        sessionId: sessionId ?? undefined,
        lines: cart,
        tip,
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
          const modTotal = line.modifiers.reduce((s, m) => s + m.priceDelta, 0);
          return (
            <li key={line.lineId} className="flex gap-3 rounded-xl border p-3">
              <BottleIcon icon={line.menuItem.icon} className="size-11" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-medium">{line.menuItem.name}</p>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatMoney((line.menuItem.price + modTotal) * line.quantity)}
                  </p>
                </div>
                {line.modifiers.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {line.modifiers.map((m) => m.optionName).join(", ")}
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

      <Separator />

      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatMoney(cartSubtotal)}</span>
        </div>
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

      {/* TODO(backend): payment step (Stripe) goes here before submission. */}
      <ConfirmDialog
        title="Place this order?"
        description={`${formatMoney(total)} total including fees and tip — the bar starts on it right away.`}
        confirmLabel={`Place order · ${formatMoney(total)}`}
        onConfirm={handleSubmit}
        trigger={
      <Button size="lg" className="h-12 w-full glow-primary" disabled={submitting}>
        {submitting && <Loader2 className="size-4 animate-spin" />}
        {submitting ? "Sending order…" : `Place order · ${formatMoney(total)}`}
      </Button>
        }
      />
    </div>
  );
}
