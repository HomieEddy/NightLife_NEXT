"use client";

import { useMemo, useState } from "react";
import { Loader2, Minus, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BottleIcon } from "@/components/shared/bottle-icon";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { menuService } from "@/lib/services/menu-service";
import { cn } from "@/features/shared/utils";
import type { MenuItem } from "@/lib/types";

/** One delivery, many bottles: set quantities per item and apply in one action. */
export function BulkRestockDialog({
  open,
  onOpenChange,
  items,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: MenuItem[];
  onDone: () => void;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
    return [...filtered].sort((a, b) => a.inventory - b.inventory || a.name.localeCompare(b.name));
  }, [items, query]);

  const lines = Object.entries(quantities).filter(([, qty]) => qty > 0);
  const totalBottles = lines.reduce((sum, [, qty]) => sum + qty, 0);

  function setQty(itemId: string, qty: number) {
    setQuantities((prev) => ({ ...prev, [itemId]: Math.max(0, qty) }));
  }

  function bumpQty(itemId: string, delta: number) {
    setQuantities((prev) => ({ ...prev, [itemId]: Math.max(0, (prev[itemId] ?? 0) + delta) }));
  }

  async function apply() {
    if (lines.length === 0) {
      toast.error("Set a quantity on at least one bottle.");
      return;
    }
    setBusy(true);
    const applied = await menuService.bulkRestock(
      lines.map(([itemId, quantity]) => ({ itemId, quantity })),
      note.trim() || undefined,
    );
    setBusy(false);
    toast.success(`Restocked ${applied} items · +${totalBottles} bottles`);
    setQuantities({});
    setNote("");
    setQuery("");
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] max-w-lg flex-col">
        <DialogHeader>
          <DialogTitle>Bulk restock</DialogTitle>
          <DialogDescription>
            Enter received quantities per bottle — everything is applied and logged in one go.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search bottles…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="-mx-1 min-h-0 flex-1 space-y-1.5 overflow-y-auto px-1 py-1">
          {visible.map((item) => {
            const qty = quantities[item.id] ?? 0;
            return (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border p-2",
                  qty > 0 && "border-primary/50 bg-primary/5",
                )}
              >
                <BottleIcon icon={item.icon} className="size-8" iconClassName="size-3.5" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <Badge
                    variant="outline"
                    className={cn(
                      "mt-0.5 px-1.5 py-0 text-[10px] tabular-nums",
                      item.inventory === 0 && "border-red-500/40 text-red-600 dark:text-red-400",
                      item.inventory > 0 && item.inventory <= 5 &&
                        "border-amber-500/40 text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {item.inventory === 0 ? "Sold out" : `${item.inventory} left`}
                  </Badge>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-7"
                    aria-label="Decrease"
                    disabled={qty === 0}
                    onClick={() => bumpQty(item.id, -1)}
                  >
                    <Minus className="size-3.5" />
                  </Button>
                  <Input
                    type="number"
                    min={0}
                    value={qty || ""}
                    placeholder="0"
                    onChange={(e) => setQty(item.id, Number(e.target.value))}
                    className="h-7 w-14 px-1 text-center tabular-nums"
                    aria-label={`Quantity for ${item.name}`}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-7"
                    aria-label="Increase"
                    onClick={() => bumpQty(item.id, 1)}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bulk-note">Delivery note (optional)</Label>
          <Input
            id="bulk-note"
            placeholder="e.g. Friday delivery — Maison Prestige"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <ConfirmDialog
            trigger={
              <Button disabled={busy || lines.length === 0}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                {busy
                  ? "Applying…"
                  : lines.length === 0
                    ? "Restock"
                    : `Restock ${lines.length} items (+${totalBottles})`}
              </Button>
            }
            title={`Apply this restock?`}
            description={`Adds ${totalBottles} bottles across ${lines.length} items and logs one movement per item.`}
            confirmLabel="Apply restock"
            onConfirm={apply}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
