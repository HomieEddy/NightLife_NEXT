"use client";

import { FeatureGate } from "@/components/shared/feature-gate";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  History,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BottleIcon } from "@/components/shared/bottle-icon";
import Link from "next/link";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination, paginate } from "@/components/shared/pagination";
import { menuService } from "@/lib/services/menu-service";
import { formatMoney, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BottleIconKey, MenuCategory, MenuItem, StockMovement } from "@/lib/types";

const ICON_OPTIONS: { key: BottleIconKey; label: string }[] = [
  { key: "champagne", label: "Champagne" },
  { key: "tequila", label: "Tequila" },
  { key: "vodka", label: "Vodka" },
  { key: "cognac", label: "Cognac" },
  { key: "rum", label: "Rhum" },
  { key: "whisky", label: "Whisky" },
  { key: "gin", label: "Gin" },
  { key: "washer", label: "Washer" },
];

const MOVEMENT_META: Record<
  StockMovement["type"],
  { label: string; className: string }
> = {
  restock: { label: "Restock", className: "text-emerald-600 dark:text-emerald-400" },
  sale: { label: "Sale", className: "text-muted-foreground" },
  adjustment: { label: "Adjustment", className: "text-amber-600 dark:text-amber-400" },
  waste: { label: "Waste", className: "text-red-600 dark:text-red-400" },
  transfer: { label: "Transfer", className: "text-blue-600 dark:text-blue-400" },
  return: { label: "Return", className: "text-orange-600 dark:text-orange-400" },
};

interface ItemDraft {
  name: string;
  description: string;
  categoryId: string;
  icon: BottleIconKey;
  price: number;
  inventory: number; // initial stock, create-only
}

export default function ManagerInventoryPage() {
  return (
    <FeatureGate feature="inventory">
      <InventoryPageContent />
    </FeatureGate>
  );
}

function InventoryPageContent() {
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Dialog state — stock changes must go through Purchasing (plan 19)
  const [adjusting, setAdjusting] = useState<MenuItem | null>(null);
  const [adjustCount, setAdjustCount] = useState(0);
  const [adjustNote, setAdjustNote] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formItem, setFormItem] = useState<MenuItem | null>(null); // null = create
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);

  const refresh = useCallback(async () => {
    const [its, cats, moves] = await Promise.all([
      menuService.listItems(),
      menuService.listCategories(true),
      menuService.listMovements(),
    ]);
    setItems(its);
    setCategories(cats);
    setMovements(moves);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const visible = useMemo(() => {
    let result = items ?? [];
    if (categoryFilter !== "all") result = result.filter((i) => i.categoryId === categoryFilter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter((i) => i.name.toLowerCase().includes(q));
    }
    return [...result].sort(
      (a, b) => a.categoryId.localeCompare(b.categoryId) || a.name.localeCompare(b.name),
    );
  }, [items, categoryFilter, query]);

  const totals = useMemo(() => {
    const all = items ?? [];
    return {
      bottlesInStock: all.reduce((sum, i) => sum + i.inventory, 0),
      stockValue: all.reduce((sum, i) => sum + i.inventory * i.price, 0),
      lowStock: all.filter((i) => i.inventory > 0 && i.inventory <= 5).length,
      soldOut: all.filter((i) => i.inventory === 0).length,
    };
  }, [items]);

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;

  // ---------- Actions ----------

  async function handleAdjust() {
    if (!adjusting || adjustCount < 0) return;
    setBusy(true);
    await menuService.adjustInventory(
      adjusting.id,
      adjustCount,
      adjustNote.trim() || undefined,
    );
    setBusy(false);
    toast.success(`${adjusting.name} set to ${adjustCount}`);
    setAdjusting(null);
    await refresh();
  }

  function openCreate() {
    setFormItem(null);
    setDraft({
      name: "",
      description: "",
      categoryId: categories[0]?.id ?? "",
      icon: "champagne",
      price: 0,
      inventory: 0,
    });
    setFormOpen(true);
  }

  function openEdit(item: MenuItem) {
    setFormItem(item);
    setDraft({
      name: item.name,
      description: item.description,
      categoryId: item.categoryId,
      icon: item.icon,
      price: item.price,
      inventory: item.inventory,
    });
    setFormOpen(true);
  }

  async function handleFormSave() {
    if (!draft) return;
    if (!draft.name.trim() || draft.price <= 0 || !draft.categoryId) {
      toast.error("Name, category and a price are required.");
      return;
    }
    setBusy(true);
    if (formItem) {
      // Edits never touch inventory — that's what restock/adjust are for.
      await menuService.updateItem(formItem.id, {
        name: draft.name.trim(),
        description: draft.description,
        categoryId: draft.categoryId,
        icon: draft.icon,
        price: draft.price,
      });
      toast.success(`${draft.name.trim()} updated`);
    } else {
      await menuService.createItem({
        name: draft.name.trim(),
        description: draft.description,
        categoryId: draft.categoryId,
        icon: draft.icon,
        price: draft.price,
        inventory: Math.max(0, draft.inventory),
        tags: [],
        isAvailable: true,
        isAlcoholic: true,
        allergens: [],
      });
      toast.success(`${draft.name.trim()} added to inventory`);
    }
    setBusy(false);
    setFormOpen(false);
    await refresh();
  }

  async function handleDelete(item: MenuItem) {
    await menuService.deleteItem(item.id);
    toast.info(`${item.name} removed from inventory`);
    await refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Stock levels and adjustments — restocking is handled via Purchasing."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/manager/purchasing">
                <ShoppingCart className="size-4" /> Order stock
              </Link>
            </Button>
            <Button onClick={openCreate}>
              <Plus className="size-4" /> Add bottle
            </Button>
          </div>
        }
      />

      {items === null ? (
        <ListSkeleton rows={6} rowHeight="h-20" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Bottles in stock" value={String(totals.bottlesInStock)} icon={Boxes} />
            <MetricCard label="Stock value" value={formatMoney(totals.stockValue)} icon={TrendingUp} hint="At menu prices" />
            <MetricCard label="Low stock" value={String(totals.lowStock)} icon={AlertTriangle} hint="5 or fewer left" />
            <MetricCard label="Sold out" value={String(totals.soldOut)} icon={TrendingDown} />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search bottles…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="No bottles match"
              description="Try a different search or category, or add a new bottle."
            />
          ) : (
            <>
            <div className="space-y-2">
              {paginate(visible, page).map((item) => {
                const soldOut = item.inventory === 0;
                const low = !soldOut && item.inventory <= 5;
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border p-3"
                  >
                    <BottleIcon icon={item.icon} className="size-10" iconClassName="size-4" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {categoryName(item.categoryId)} · {formatMoney(item.price)}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 tabular-nums",
                        soldOut && "border-red-500/40 text-red-600 dark:text-red-400",
                        low && "border-amber-500/40 text-amber-600 dark:text-amber-400",
                      )}
                    >
                      {soldOut ? "Sold out" : `${item.inventory} left`}
                    </Badge>
                    <Button size="sm" variant="outline" className="shrink-0" asChild>
                      <Link href="/manager/purchasing">
                        <ShoppingCart className="size-3.5" />
                        <span className="hidden sm:inline ml-1">Order</span>
                      </Link>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="shrink-0" aria-label="More actions">
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(item)}>
                          <Pencil className="size-4" /> Edit details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setAdjusting(item);
                            setAdjustCount(item.inventory);
                            setAdjustNote("");
                          }}
                        >
                          <SlidersHorizontal className="size-4" /> Adjust count
                        </DropdownMenuItem>
                        <ConfirmDialog
                          trigger={
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={(e) => e.preventDefault()}
                            >
                              <Trash2 className="size-4" /> Delete bottle
                            </DropdownMenuItem>
                          }
                          title={`Delete ${item.name}?`}
                          description="Removes it from inventory and the guest menu. Packages using it will show as out of stock."
                          confirmLabel="Delete"
                          destructive
                          onConfirm={() => handleDelete(item)}
                        />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
            <Pagination totalItems={visible.length} currentPage={page} onPageChange={setPage} className="mt-3" />
            </>
          )}

          {/* ---------- Movement log ---------- */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="size-4 text-primary" /> Recent stock movements
              </CardTitle>
            </CardHeader>
            <CardContent>
              {movements.length === 0 ? (
                <p className="text-sm text-muted-foreground">No movements recorded yet.</p>
              ) : (
                <ul className="space-y-2">
                  {movements.slice(0, 10).map((move) => {
                    const meta = MOVEMENT_META[move.type];
                    return (
                      <li
                        key={move.id}
                        className="flex items-center justify-between gap-3 rounded-lg border p-2.5 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate">
                            <span className={cn("font-medium", meta.className)}>
                              {meta.label}
                            </span>{" "}
                            · {move.itemName}
                          </p>
                          {move.note && (
                            <p className="truncate text-xs text-muted-foreground">{move.note}</p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <p
                            className={cn(
                              "font-semibold tabular-nums",
                              move.delta > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-muted-foreground",
                            )}
                          >
                            {move.delta > 0 ? `+${move.delta}` : move.delta}
                          </p>
                          <p className="text-xs text-muted-foreground">{timeAgo(move.createdAt)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ---------- Adjust count dialog ---------- */}
      <Dialog open={adjusting !== null} onOpenChange={(open) => !open && setAdjusting(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adjust {adjusting?.name}</DialogTitle>
            <DialogDescription>
              For corrections — breakage, comps, recount. Currently {adjusting?.inventory} in
              stock; the difference is logged as an adjustment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="adjust-count">Actual count</Label>
              <Input
                id="adjust-count"
                type="number"
                min={0}
                value={adjustCount}
                onChange={(e) => setAdjustCount(Math.max(0, Number(e.target.value)))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adjust-note">Reason</Label>
              <Textarea
                id="adjust-note"
                rows={2}
                placeholder="e.g. Two bottles broken during setup"
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdjusting(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={handleAdjust} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {busy ? "Saving…" : "Save count"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Create / edit item dialog ---------- */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[85dvh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{formItem ? `Edit ${formItem.name}` : "Add a bottle"}</DialogTitle>
            {formItem && (
              <DialogDescription>
                Stock changes are handled via Purchasing or the Adjust action, not here.
              </DialogDescription>
            )}
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="item-name">Name</Label>
                <Input
                  id="item-name"
                  placeholder="e.g. Veuve Clicquot Brut"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-desc">Description</Label>
                <Textarea
                  id="item-desc"
                  rows={2}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select
                    value={draft.categoryId}
                    onValueChange={(value) => setDraft({ ...draft, categoryId: value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Icon</Label>
                  <Select
                    value={draft.icon}
                    onValueChange={(value) => setDraft({ ...draft, icon: value as BottleIconKey })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ICON_OPTIONS.map((opt) => (
                        <SelectItem key={opt.key} value={opt.key}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="item-price">Price ($ CAD)</Label>
                  <Input
                    id="item-price"
                    type="number"
                    min={0}
                    step={5}
                    value={draft.price || ""}
                    onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
                  />
                </div>
                {!formItem && (
                  <div className="space-y-1.5">
                    <Label htmlFor="item-stock">Initial stock</Label>
                    <Input
                      id="item-stock"
                      type="number"
                      min={0}
                      value={draft.inventory}
                      onChange={(e) =>
                        setDraft({ ...draft, inventory: Math.max(0, Number(e.target.value)) })
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={handleFormSave} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {busy ? "Saving…" : formItem ? "Save changes" : "Add bottle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
