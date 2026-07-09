"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { BottleIcon } from "@/components/shared/bottle-icon";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useGuest } from "@/context/guest-context";
import type { MenuItem, OrderItemModifier } from "@/lib/types";

export function ItemDetailModal({
  item,
  onClose,
}: {
  item: MenuItem | null;
  onClose: () => void;
}) {
  const { addToCart } = useGuest();
  const [quantity, setQuantity] = useState(1);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [note, setNote] = useState("");

  // Reset per item via key on DialogContent below.
  const modifiers: OrderItemModifier[] = useMemo(() => {
    if (!item) return [];
    return item.modifierGroups.flatMap((group) =>
      (selected[group.id] ?? []).map((optionId) => {
        const option = group.options.find((o) => o.id === optionId)!;
        return { groupName: group.name, optionName: option.name, priceDelta: option.priceDelta };
      }),
    );
  }, [item, selected]);

  const unitTotal = item
    ? item.price + modifiers.reduce((s, m) => s + m.priceDelta, 0)
    : 0;

  const missingRequired = item
    ? item.modifierGroups.some((g) => g.required && !(selected[g.id]?.length))
    : false;

  function toggleOption(groupId: string, optionId: string, maxSelections: number) {
    setSelected((prev) => {
      const current = prev[groupId] ?? [];
      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
      }
      if (maxSelections === 1) return { ...prev, [groupId]: [optionId] };
      if (current.length >= maxSelections) return prev;
      return { ...prev, [groupId]: [...current, optionId] };
    });
  }

  function handleAdd() {
    if (!item) return;
    addToCart(item, quantity, modifiers, note.trim() || undefined);
    toast.success(`${quantity}× ${item.name} added to cart`);
    handleClose();
  }

  function handleClose() {
    setQuantity(1);
    setSelected({});
    setNote("");
    onClose();
  }

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent key={item?.id} className="max-h-[85dvh] max-w-lg overflow-y-auto">
        {item && (
          <>
            <DialogHeader className="text-left">
              <BottleIcon icon={item.icon} className="size-14 rounded-xl" iconClassName="size-6" />
              <DialogTitle className="mt-1">{item.name}</DialogTitle>
              <DialogDescription>{item.description}</DialogDescription>
              <p className="text-lg font-semibold text-primary">{formatMoney(item.price)}</p>
            </DialogHeader>

            {item.modifierGroups.map((group) => (
              <div key={group.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{group.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {group.required ? "Required" : "Optional"}
                    {group.maxSelections > 1 && ` · up to ${group.maxSelections}`}
                  </p>
                </div>
                <div className="space-y-1.5">
                  {group.options.map((option) => {
                    const active = (selected[group.id] ?? []).includes(option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => toggleOption(group.id, option.id, group.maxSelections)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm transition-colors",
                          active
                            ? "border-primary bg-primary/10 text-foreground"
                            : "hover:bg-accent/50",
                        )}
                      >
                        <span>{option.name}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {option.priceDelta > 0 ? `+${formatMoney(option.priceDelta)}` : "Free"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="space-y-1.5">
              <p className="text-sm font-medium">Note for staff</p>
              <Textarea
                placeholder="e.g. extra limes, no straw…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex items-center gap-3 border-t pt-4">
              <div className="flex items-center gap-1 rounded-lg border p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                >
                  <Minus className="size-4" />
                </Button>
                <span className="w-8 text-center font-semibold tabular-nums">{quantity}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  onClick={() => setQuantity((q) => Math.min(item.inventory, q + 1))}
                  aria-label="Increase quantity"
                >
                  <Plus className="size-4" />
                </Button>
              </div>
              <Button
                className="h-11 flex-1"
                onClick={handleAdd}
                disabled={missingRequired}
              >
                <ShoppingBag className="size-4" />
                Add · {formatMoney(unitTotal * quantity)}
              </Button>
            </div>
            {missingRequired && (
              <p className="text-center text-xs text-amber-600 dark:text-amber-400">
                Choose the required options above first.
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
