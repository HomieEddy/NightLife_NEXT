"use client";

import { FeatureGate } from "@/components/shared/feature-gate";

import { useEffect, useMemo, useState } from "react";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { useTranslations } from "next-intl";
import { useInfiniteSlice } from "@/hooks/use-infinite-slice";
import { InfiniteScrollSentinel } from "@/components/shared/infinite-scroll-sentinel";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { menuService } from "@/features/menu/services";
import { purchasingService } from "@/features/platform/purchasing-service";
import { menuKeys } from "@/features/menu/query-keys";
import { inventoryKeys } from "@/features/inventory/query-keys";
import { useAuth } from "@/context/auth-context";
import { formatMoney, timeAgo } from "@/features/shared/format";
import { z } from "zod";
import { cn } from "@/features/shared/utils";
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
  { labelKey: string; className: string }
> = {
  restock: { labelKey: "movementLabels.restock", className: "text-emerald-600 dark:text-emerald-400" },
  sale: { labelKey: "movementLabels.sale", className: "text-muted-foreground" },
  adjustment: { labelKey: "movementLabels.adjustment", className: "text-amber-600 dark:text-amber-400" },
  waste: { labelKey: "movementLabels.waste", className: "text-red-600 dark:text-red-400" },
  transfer: { labelKey: "movementLabels.transfer", className: "text-blue-600 dark:text-blue-400" },
  return: { labelKey: "movementLabels.return", className: "text-orange-600 dark:text-orange-400" },
};

export default function ManagerInventoryPage() {
  return (
    <FeatureGate feature="inventory">
      <InventoryPageContent />
    </FeatureGate>
  );
}

function InventoryPageContent() {
  const t = useTranslations("manager.inventory");
  const { user } = useAuth();
  const venueId = user?.venueId ?? "";
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Dialog state — stock changes must go through Purchasing (plan 19)
  const [adjusting, setAdjusting] = useState<MenuItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formItem, setFormItem] = useState<MenuItem | null>(null); // null = create

  // Waste dialog
  const [wasteItem, setWasteItem] = useState<MenuItem | null>(null);

  const zItemForm = z.object({
    name: z.string().min(1, t("validation.nameRequired")),
    description: z.string().default(""),
    categoryId: z.string().min(1, t("validation.categoryRequired")),
    icon: z.string().min(1, t("validation.iconRequired")),
    price: z.number().positive(t("validation.pricePositive")),
    initialStock: z.number().int().nonnegative().default(0),
  });

  const zAdjustForm = z.object({
    count: z.string().min(1, t("validation.countRequired")),
    note: z.string().default(""),
  });

  const zWasteForm = z.object({
    quantity: z.string().min(1, t("validation.quantityRequired")),
    reason: z.string().min(1, t("validation.reasonRequired")),
  });

  const itemForm = useForm({
    resolver: zodResolver(zItemForm),
    defaultValues: { name: "", description: "", categoryId: "", icon: "champagne", price: 0, initialStock: 0 },
  });

  const adjustForm = useForm({
    resolver: zodResolver(zAdjustForm),
    defaultValues: { count: "", note: "" },
  });

  const wasteForm = useForm({
    resolver: zodResolver(zWasteForm),
    defaultValues: { quantity: "", reason: "spill" },
  });

  const { data: items } = useQuery({
    queryKey: menuKeys.items(venueId),
    queryFn: () => menuService.listItems(),
    enabled: !!venueId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: menuKeys.categories(venueId),
    queryFn: () => menuService.listCategories(true),
    enabled: !!venueId,
  });

  const { data: movements = [] } = useQuery({
    queryKey: inventoryKeys.movements(venueId),
    queryFn: () => menuService.listMovements(),
    enabled: !!venueId,
  });

  const invalidateItems = () => queryClient.invalidateQueries({ queryKey: menuKeys.items(venueId) });
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: menuKeys.items(venueId) });
    queryClient.invalidateQueries({ queryKey: inventoryKeys.all(venueId) });
  };

  const adjustMutation = useMutation({
    mutationFn: async (data: { count: string; note: string }) => {
      if (!adjusting) throw new Error("No item selected");
      const count = parseInt(data.count) || 0;
      await menuService.adjustInventory(adjusting.id, count, data.note.trim() || undefined);
      return { count, name: adjusting.name };
    },
    onSuccess: ({ count, name }) => {
      toast.success(t("toast.adjustedTo", { name, count }));
      setAdjusting(null);
      adjustForm.reset();
      invalidateAll();
    },
    onError: () => toast.error(t("toast.adjustError")),
  });

  const saveMutation = useMutation({
    mutationFn: async (data: z.infer<typeof zItemForm>) => {
      if (formItem) {
        await menuService.updateItem(formItem.id, {
          name: data.name.trim(),
          description: data.description,
          categoryId: data.categoryId,
          icon: data.icon as BottleIconKey,
          price: data.price,
        });
        return t("toast.updated", { name: data.name.trim() });
      } else {
        await menuService.createItem({
          name: data.name.trim(),
          description: data.description,
          categoryId: data.categoryId,
          icon: data.icon as BottleIconKey,
          price: data.price,
          inventory: Math.max(0, data.initialStock),
          tags: [],
          isAvailable: true,
          isAlcoholic: true,
          allergens: [],
        });
        return t("toast.added", { name: data.name.trim() });
      }
    },
    onSuccess: (message) => {
      toast.success(message);
      setFormOpen(false);
      invalidateItems();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("toast.saveFailed")),
  });

  const deleteMutation = useMutation({
    mutationFn: (item: MenuItem) => menuService.deleteItem(item.id),
    onSuccess: (_, item) => {
      toast.info(t("toast.removed", { name: item.name }));
      invalidateItems();
    },
  });

  const wasteMutation = useMutation({
    mutationFn: async (data: z.infer<typeof zWasteForm>) => {
      if (!wasteItem) throw new Error("No item selected");
      await purchasingService.recordWaste(wasteItem.id, parseInt(data.quantity) || 0, data.reason, "staff-amara");
      return { quantity: data.quantity, name: wasteItem.name, reason: data.reason };
    },
    onSuccess: ({ quantity, name, reason }) => {
      toast.info(t("toast.wasted", { quantity, name, reason }));
      setWasteItem(null);
      wasteForm.reset();
      invalidateAll();
    },
    onError: () => toast.error(t("toast.wasteError")),
  });

  const eightySixMutation = useMutation({
    mutationFn: (item: MenuItem) =>
      purchasingService.eightySixItem(item.id, "Manual 86 from inventory", "staff-amara"),
    onSuccess: (_, item) => {
      toast.info(t("toast.marked86d", { name: item.name }));
      invalidateAll();
    },
    onError: () => toast.error(t("toast.eightysixError")),
  });

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

  const { sliced, hasMore, loadMore, reset } = useInfiniteSlice(visible, 10);

  useEffect(() => { reset(); }, [query, categoryFilter, reset]);

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

  // ---------- Dialog helpers ----------

  function openCreate() {
    setFormItem(null);
    itemForm.reset({ name: "", description: "", categoryId: categories[0]?.id ?? "", icon: "champagne", price: 0, initialStock: 0 });
    setFormOpen(true);
  }

  function openEdit(item: MenuItem) {
    setFormItem(item);
    itemForm.reset({
      name: item.name,
      description: item.description,
      categoryId: item.categoryId,
      icon: item.icon,
      price: item.price,
      initialStock: 0,
    });
    setFormOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: t("breadcrumbCatalogue"), href: "/manager/menu" }, { label: t("breadcrumbInventory") }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/manager/purchasing">
                <ShoppingCart className="size-4" /> {t("orderStock")}
              </Link>
            </Button>
            <Button onClick={openCreate}>
              <Plus className="size-4" /> {t("addBottle")}
            </Button>
          </div>
        }
      />

      {items === undefined ? (
        <ListSkeleton rows={6} rowHeight="h-20" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label={t("metrics.bottlesInStock")} value={String(totals.bottlesInStock)} icon={Boxes} />
            <MetricCard label={t("metrics.stockValue")} value={formatMoney(totals.stockValue)} icon={TrendingUp} hint={t("metrics.stockValueHint")} />
            <MetricCard label={t("metrics.lowStock")} value={String(totals.lowStock)} icon={AlertTriangle} hint={t("metrics.lowStockHint")} />
            <MetricCard label={t("metrics.soldOut")} value={String(totals.soldOut)} icon={TrendingDown} />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("searchPlaceholder")}
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
                <SelectItem value="all">{t("allCategories")}</SelectItem>
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
              title={t("emptyTitle")}
              description={t("emptyDesc")}
            />
          ) : (
            <>
            <div className="space-y-2">
              {sliced.map((item) => {
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
                      {soldOut ? t("soldOutBadge") : t("leftBadge", { count: item.inventory })}
                    </Badge>
                    <Button size="sm" variant="outline" className="shrink-0" asChild>
                      <Link href="/manager/purchasing">
                        <ShoppingCart className="size-3.5" />
                        <span className="hidden sm:inline ml-1">{t("orderButton")}</span>
                      </Link>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="shrink-0" aria-label={t("moreActionsAria")}>
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(item)}>
                          <Pencil className="size-4" /> {t("editDetails")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setAdjusting(item);
                            adjustForm.reset({ count: "", note: "" });
                          }}
                        >
                          <SlidersHorizontal className="size-4" /> {t("adjustCount")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setWasteItem(item);
                            wasteForm.reset({ quantity: "", reason: "spill" });
                          }}
                        >
                          <Trash2 className="size-4" /> {t("recordWaste")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => eightySixMutation.mutate(item)}
                        >
                          <AlertTriangle className="size-4" /> {t("mark86d")}
                        </DropdownMenuItem>
                        <ConfirmDialog
                          trigger={
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={(e) => e.preventDefault()}
                            >
                              <Trash2 className="size-4" /> {t("deleteBottle")}
                            </DropdownMenuItem>
                          }
                          title={t("delete.title", { name: item.name })}
                          description={t("delete.desc")}
                          confirmLabel={t("delete.confirm")}
                          destructive
                          onConfirm={() => deleteMutation.mutate(item)}
                        />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
            <InfiniteScrollSentinel onLoadMore={loadMore} hasMore={hasMore} />
            </>
          )}

          {/* ---------- Movement log ---------- */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="size-4 text-primary" /> {t("recentMovements")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {movements.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noMovements")}</p>
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
                              {t(meta.labelKey)}
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
      <Dialog open={adjusting !== null} onOpenChange={(open) => { if (!open) { setAdjusting(null); adjustForm.reset(); }}}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("adjustTitle", { name: adjusting?.name ?? "" })}</DialogTitle>
            <DialogDescription>
              {t("adjustDesc", { count: adjusting?.inventory ?? 0 })}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={adjustForm.handleSubmit((data) => adjustMutation.mutate(data))} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="adjust-count">{t("actualCount")}</Label>
              <Input
                id="adjust-count"
                type="number"
                min={0}
                {...adjustForm.register("count")}
              />
              {adjustForm.formState.errors.count && <p className="text-xs text-destructive">{adjustForm.formState.errors.count.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adjust-note">{t("reasonLabel")}</Label>
              <Textarea
                id="adjust-note"
                rows={2}
                placeholder={t("reasonPlaceholder")}
                {...adjustForm.register("note")}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAdjusting(null)} disabled={adjustMutation.isPending}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={adjustMutation.isPending}>
                {adjustMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                {adjustMutation.isPending ? t("saving") : t("saveCount")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---------- Create / edit item dialog ---------- */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[85dvh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{formItem ? t("editTitle", { name: formItem.name }) : t("addBottleTitle")}</DialogTitle>
            {formItem && (
              <DialogDescription>
                {t("editDesc")}
              </DialogDescription>
            )}
          </DialogHeader>
          <form onSubmit={itemForm.handleSubmit((data) => saveMutation.mutate(data))} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="item-name">{t("nameLabel")}</Label>
              <Input
                id="item-name"
                placeholder={t("namePlaceholder")}
                {...itemForm.register("name")}
              />
              {itemForm.formState.errors.name && <p className="text-xs text-destructive">{itemForm.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-desc">{t("descriptionLabel")}</Label>
              <Textarea
                id="item-desc"
                rows={2}
                {...itemForm.register("description")}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("categoryLabel")}</Label>
                <Select
                  value={itemForm.watch("categoryId")}
                  onValueChange={(value) => itemForm.setValue("categoryId", value)}
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
                {itemForm.formState.errors.categoryId && <p className="text-xs text-destructive">{itemForm.formState.errors.categoryId.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>{t("iconLabel")}</Label>
                <Select
                  value={itemForm.watch("icon")}
                  onValueChange={(value) => itemForm.setValue("icon", value)}
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
                {itemForm.formState.errors.icon && <p className="text-xs text-destructive">{itemForm.formState.errors.icon.message}</p>}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="item-price">{t("priceLabel")}</Label>
                <Input
                  id="item-price"
                  type="number"
                  min={0}
                  step={5}
                  {...itemForm.register("price", { valueAsNumber: true })}
                />
                {itemForm.formState.errors.price && <p className="text-xs text-destructive">{itemForm.formState.errors.price.message}</p>}
              </div>
              {!formItem && (
                <div className="space-y-1.5">
                  <Label htmlFor="item-stock">{t("initialStock")}</Label>
                  <Input
                    id="item-stock"
                    type="number"
                    min={0}
                    {...itemForm.register("initialStock", { valueAsNumber: true })}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setFormOpen(false)} disabled={saveMutation.isPending}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                {saveMutation.isPending ? t("saving") : formItem ? t("saveChanges") : t("addBottle")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---------- Waste dialog ---------- */}
      <Dialog open={wasteItem !== null} onOpenChange={(open) => { if (!open) { setWasteItem(null); wasteForm.reset(); }}}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("wasteTitle", { name: wasteItem?.name ?? "" })}</DialogTitle>
            <DialogDescription>
              {t("wasteDesc")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={wasteForm.handleSubmit((data) => wasteMutation.mutate(data))} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="waste-qty">{t("quantityWasted")}</Label>
              <Input
                id="waste-qty"
                type="number"
                min={1}
                max={wasteItem?.inventory ?? 0}
                {...wasteForm.register("quantity")}
              />
              {wasteForm.formState.errors.quantity && <p className="text-xs text-destructive">{wasteForm.formState.errors.quantity.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="waste-reason">{t("reasonLabel")}</Label>
              <Select value={wasteForm.watch("reason")} onValueChange={(v) => wasteForm.setValue("reason", v)}>
                <SelectTrigger id="waste-reason"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="spill">{t("wasteReasons.spill")}</SelectItem>
                  <SelectItem value="breakage">{t("wasteReasons.breakage")}</SelectItem>
                  <SelectItem value="expired">{t("wasteReasons.expired")}</SelectItem>
                  <SelectItem value="comp-prep">{t("wasteReasons.compPrep")}</SelectItem>
                  <SelectItem value="training">{t("wasteReasons.training")}</SelectItem>
                </SelectContent>
              </Select>
              {wasteForm.formState.errors.reason && <p className="text-xs text-destructive">{wasteForm.formState.errors.reason.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setWasteItem(null)} disabled={wasteMutation.isPending}>{t("cancel")}</Button>
              <Button type="submit" disabled={wasteMutation.isPending}>
                {wasteMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                {wasteMutation.isPending ? t("saving") : t("recordWasteButton")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
