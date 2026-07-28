"use client";

import { useMemo, useRef, useState } from "react";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { gsap } from "@/lib/gsap";
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
import { formatMoney } from "@/features/shared/format";
import { cn } from "@/features/shared/utils";
import { useGuest } from "@/context/guest-context";
import { orderLineSubtotal } from "@/lib/order-line";
import type { MenuItem, ModifierGroup, OrderItemModifier } from "@/lib/types";

export function ItemDetailModal({
  item,
  modifierGroups,
  onClose,
}: {
  item: MenuItem | null;
  modifierGroups: ModifierGroup[];
  onClose: () => void;
}) {
  const { addToCart } = useGuest();
  const [quantity, setQuantity] = useState(1);
  const [selected, setSelected] = useState<Record<string, Record<string, number>>>({});
  const [note, setNote] = useState("");
  const addBtnRef = useRef<HTMLButtonElement>(null);

  // Reset per item via key on DialogContent below.
  const modifiers: OrderItemModifier[] = useMemo(() => {
    if (!item) return [];
    return modifierGroups.flatMap((group) =>
      Object.entries(selected[group.id] ?? {}).map(([optionId, quantity]) => {
        const option = group.options.find((entry) => entry.id === optionId)!;
        return {
          groupId: group.id,
          optionId,
          kind: group.kind,
          groupName: group.name,
          optionName: option.name,
          priceDelta: option.priceDelta,
          quantity,
        };
      }),
    );
  }, [item, modifierGroups, selected]);

  const lineTotal = item ? orderLineSubtotal(item.price, quantity, modifiers) : 0;

  const missingRequired = item
    ? modifierGroups.some((group) => group.required && !Object.keys(selected[group.id] ?? {}).length)
    : false;

  function toggleOption(group: ModifierGroup, optionId: string) {
    setSelected((prev) => {
      const current = prev[group.id] ?? {};
      if (current[optionId]) {
        const remaining = { ...current };
        delete remaining[optionId];
        return { ...prev, [group.id]: remaining };
      }
      if (group.maxSelections === 1) return { ...prev, [group.id]: { [optionId]: 1 } };
      if (Object.keys(current).length >= group.maxSelections) return prev;
      return { ...prev, [group.id]: { ...current, [optionId]: 1 } };
    });
  }

  function changeOptionQuantity(groupId: string, optionId: string, next: number) {
    setSelected((prev) => ({
      ...prev,
      [groupId]: { ...prev[groupId], [optionId]: next },
    }));
  }

  function handleAdd() {
    if (!item) return;
    addToCart(item, quantity, modifiers, note.trim() || undefined);
    toast.success(`${quantity}× ${item.name} added to cart`);
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && addBtnRef.current) {
      const btnRect = addBtnRef.current.getBoundingClientRect();
      const pill = document.getElementById("cart-pill");
      if (pill) {
        const pillRect = pill.getBoundingClientRect();
        const clone = document.createElement("span");
        clone.textContent = `+${formatMoney(lineTotal)}`;
        clone.className = "text-sm font-semibold text-primary tabular-nums";
        clone.style.position = "fixed";
        clone.style.left = `${btnRect.left}px`;
        clone.style.top = `${btnRect.top}px`;
        clone.style.zIndex = "9999";
        clone.style.pointerEvents = "none";
        document.body.appendChild(clone);
        gsap.to(clone, {
          x: pillRect.left + pillRect.width / 2 - btnRect.left,
          y: pillRect.top + pillRect.height / 2 - btnRect.top,
          scale: 0.4,
          opacity: 0,
          duration: 0.4,
          ease: "power2.in",
          onComplete: () => clone.remove(),
        });
      }
    }
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

            {modifierGroups.filter((group) => group.isActive).map((group) => (
              <div key={group.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{group.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {group.required ? "Required" : "Optional"}
                    {group.maxSelections > 1 && ` · up to ${group.maxSelections}`}
                  </p>
                </div>
                <div className="space-y-1.5">
                  {group.options.filter((option) => option.isActive).map((option) => {
                    const selectedQuantity = selected[group.id]?.[option.id] ?? 0;
                    const active = selectedQuantity > 0;
                    return (
                      <div
                        key={`${option.id}-${active}`}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm transition-colors animate-pop-in",
                          active
                            ? "border-primary bg-primary/10 text-foreground"
                            : "hover:bg-accent/50",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => toggleOption(group, option.id)}
                          className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                        >
                          <span>{option.name}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {option.priceDelta > 0 ? `+${formatMoney(option.priceDelta)}` : "Free"}
                          </span>
                        </button>
                        {active && group.kind === "washer" && option.maxQuantity > 1 && (
                          <div className="ml-3 flex items-center gap-1 border-l pl-3">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => changeOptionQuantity(group.id, option.id, Math.max(1, selectedQuantity - 1))}
                              aria-label={`Decrease ${option.name}`}
                            >
                              <Minus className="size-3.5" />
                            </Button>
                            <span className="w-5 text-center tabular-nums">{selectedQuantity}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => changeOptionQuantity(group.id, option.id, Math.min(option.maxQuantity, selectedQuantity + 1))}
                              aria-label={`Increase ${option.name}`}
                            >
                              <Plus className="size-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
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
                <span key={quantity} className="w-8 text-center font-semibold tabular-nums animate-pop-in">{quantity}</span>
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
                ref={addBtnRef}
                className="h-11 flex-1"
                onClick={handleAdd}
                disabled={missingRequired}
              >
                <ShoppingBag className="size-4" />
                Add · {formatMoney(lineTotal)}
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
