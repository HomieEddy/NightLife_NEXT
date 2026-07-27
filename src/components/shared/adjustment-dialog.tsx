"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ordersService } from "@/lib/services/orders-service";
import { formatMoney } from "@/lib/format";
import { orderItemAmountCents, orderItemPartialAmountCents, orderTotalCents } from "@/lib/tab";
import type { AdjustmentReason, Order, TabAdjustmentKind } from "@/lib/types";

const KIND_LABEL: Record<TabAdjustmentKind, string> = {
  void: "Void",
  comp: "Comp",
  discount: "Discount",
};

const KIND_HELP: Record<TabAdjustmentKind, string> = {
  void: "It never happened — removes the line from revenue and returns the stock.",
  comp: "It happened, the guest doesn't pay — stock stays depleted, lands as a house cost.",
  discount: "It happened, the guest pays less — reduces revenue by the delta only.",
};

/**
 * The one adjustment flow for the whole app — void / comp / discount, whole
 * order or one line or a partial quantity of one line. Shared between staff
 * and manager order cards (AGENTS.md §4.1: one dialog, one ledger).
 */
export function AdjustmentDialog({
  order,
  availableKinds,
  authorStaffId,
  authorStaffName,
  compThresholdCents,
  isManager,
  onDone,
  trigger,
}: {
  order: Order;
  availableKinds: TabAdjustmentKind[];
  authorStaffId: string;
  authorStaffName: string;
  compThresholdCents: number;
  isManager: boolean;
  onDone: () => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // "" = whole order; otherwise an order-item id — the scope picker.
  const [itemId, setItemId] = useState("");
  const [kind, setKind] = useState<TabAdjustmentKind>(availableKinds[0] ?? "comp");
  const [quantity, setQuantity] = useState(1);
  const [reasonCode, setReasonCode] = useState("");
  const [note, setNote] = useState("");
  const [reasons, setReasons] = useState<AdjustmentReason[]>([]);
  const [saving, setSaving] = useState(false);

  const item = itemId ? order.items.find((i) => i.id === itemId) : undefined;

  useEffect(() => {
    if (!open) return;
    setReasonCode("");
    ordersService.listAdjustmentReasons(kind).then(setReasons);
  }, [open, kind]);

  // Reset the draft only on the closed→open transition — NOT on every parent
  // re-render. `availableKinds` is a fresh array on each render (built inline
  // by the caller), so keying this effect on it would silently wipe an
  // in-progress selection whenever a background poll refreshes the page.
  useEffect(() => {
    if (!open) return;
    setItemId("");
    setKind(availableKinds[0] ?? "comp");
    setQuantity(1);
    setNote("");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally excludes availableKinds, see comment above
  }, [open]);

  useEffect(() => {
    setQuantity(item?.quantity ?? 1);
  }, [item]);

  const targetFullCents = item ? orderItemAmountCents(item) : orderTotalCents(order);
  const amountCents = item ? orderItemPartialAmountCents(item, quantity) : targetFullCents;
  const overThreshold = kind === "comp" && amountCents > compThresholdCents && !isManager;

  const label = item ? `${quantity} × ${item.name}` : `order ${order.code}`;
  const reasonLabel = useMemo(
    () => reasons.find((r) => r.code === reasonCode)?.label,
    [reasons, reasonCode],
  );

  async function submit() {
    setSaving(true);
    try {
      await ordersService.adjustOrder({
        orderId: order.id,
        orderItemId: item?.id,
        quantity: item ? quantity : undefined,
        kind,
        reasonCode,
        note: note || undefined,
        authorStaffId,
        authorStaffName,
      });
      toast.success(`${KIND_LABEL[kind]}ed ${label} — ${formatMoney(amountCents / 100)}`);
      setOpen(false);
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record the adjustment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Adjust {label}</DialogTitle>
          <DialogDescription>
            {order.tableCode} · {order.guestName} · full amount {formatMoney(targetFullCents / 100)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="adj-scope">Scope</Label>
            <Select value={itemId || "__order__"} onValueChange={(v) => setItemId(v === "__order__" ? "" : v)}>
              <SelectTrigger id="adj-scope" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__order__">Whole order</SelectItem>
                {order.items.map((line) => (
                  <SelectItem key={line.id} value={line.id}>
                    {line.quantity}× {line.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-1.5">
            {availableKinds.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={
                  "rounded-full border px-3 py-1 text-sm font-medium transition-colors " +
                  (kind === k
                    ? "border-primary bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{KIND_HELP[kind]}</p>

          {item && item.quantity > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="adj-qty">Quantity ({item.quantity} on the line)</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                >
                  −
                </Button>
                <span className="w-8 text-center tabular-nums">{quantity}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantity((q) => Math.min(item.quantity, q + 1))}
                  disabled={quantity >= item.quantity}
                >
                  +
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="adj-reason">Reason</Label>
            <Select value={reasonCode} onValueChange={setReasonCode}>
              <SelectTrigger id="adj-reason" className="w-full">
                <SelectValue placeholder="Choose a reason…" />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((r) => (
                  <SelectItem key={r.code} value={r.code}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adj-note">Note (optional)</Label>
            <Textarea
              id="adj-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add context for the audit trail…"
              rows={2}
            />
          </div>

          {overThreshold && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              This comp ({formatMoney(amountCents / 100)}) is over the venue&apos;s {formatMoney(compThresholdCents / 100)} threshold —
              ask a manager to approve it.
            </p>
          )}
        </div>

        <DialogFooter>
          <ConfirmDialog
            trigger={
              <Button disabled={!reasonCode || overThreshold || saving} className="w-full">
                {saving ? "Recording…" : `${KIND_LABEL[kind]} ${label}`}
              </Button>
            }
            title={`${KIND_LABEL[kind]} ${label} — ${formatMoney(amountCents / 100)}${reasonLabel ? ` — ${reasonLabel}` : ""}?`}
            description={
              kind === "void"
                ? `Removes this from revenue and returns ${item ? quantity : "every unit on this order"} to inventory.`
                : kind === "comp"
                  ? "Removes this from revenue as a house gift. Inventory is not returned — the product left the building."
                  : "Reduces revenue by this amount. Inventory is not affected."
            }
            confirmLabel={`${KIND_LABEL[kind]} it`}
            onConfirm={submit}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
