"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Gift, Loader2, Martini, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TooltipIconButton } from "@/components/shared/tooltip-icon-button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { BottleIcon } from "@/components/shared/bottle-icon";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { MenuItemCard } from "@/components/shared/menu-item-card";
import { PageHeader } from "@/components/shared/page-header";
import { useInfiniteSlice } from "@/hooks/use-infinite-slice";
import { InfiniteScrollSentinel } from "@/components/shared/infinite-scroll-sentinel";
import { PackageEditor, type PackageDraft } from "@/components/manager/package-editor";
import { ModifierPresetEditor } from "@/components/manager/modifier-preset-editor";
import { menuService, type PackageQuote } from "@/features/menu/services";
import { menuKeys } from "@/features/menu/query-keys";
import { useAuth } from "@/context/auth-context";
import { formatMoney } from "@/features/shared/format";
import { cn } from "@/features/shared/utils";
import type { BottlePackage, MenuCategory, MenuItem, ModifierGroup } from "@/lib/types";

type PackageWithQuote = BottlePackage & { quote: PackageQuote };

function MenuContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const venueId = user?.venueId ?? "";
  const queryClient = useQueryClient();

  const [activeCategory, setActiveCategory] = useState<string>(
    searchParams.get("category") ?? "",
  );
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<BottlePackage | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);

  const zCategoryForm = z.object({
    name: z.string().min(1, "Name is required"),
    sortOrder: z.number().int().nonnegative().default(0),
    description: z.string().default(""),
    isActive: z.boolean().default(true),
  });

  const zItemEditForm = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().default(""),
    price: z.number().positive("Price must be positive"),
    isAlcoholic: z.boolean().default(true),
    // Blank ABV is legitimate (unknown), so an empty string parses to undefined
    // rather than failing validation.
    abv: z.union([z.number().min(0).max(100), z.nan()]).optional(),
    allergens: z.string().default(""),
  });

  const categoryForm = useForm({
    resolver: zodResolver(zCategoryForm),
    defaultValues: { name: "", sortOrder: 0, description: "", isActive: true },
  });

  const itemForm = useForm({
    resolver: zodResolver(zItemEditForm),
    defaultValues: { name: "", description: "", price: 0, isAlcoholic: true, abv: undefined, allergens: "" },
  });

  const { data: categories } = useQuery({
    queryKey: menuKeys.categories(venueId),
    queryFn: () => menuService.listCategories(true),
    enabled: !!venueId,
  });

  const { data: items = [] } = useQuery({
    queryKey: menuKeys.items(venueId),
    queryFn: () => menuService.listItems(),
    enabled: !!venueId,
  });

  const { data: packages = [] } = useQuery({
    queryKey: menuKeys.packages(venueId),
    queryFn: () => menuService.listPackages(true),
    enabled: !!venueId,
  });

  // Set initial activeCategory once categories land
  useEffect(() => {
    if (categories?.length && !activeCategory) {
      setActiveCategory(categories[0]?.id ?? "");
    }
  }, [categories, activeCategory]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: menuKeys.categories(venueId) });
    queryClient.invalidateQueries({ queryKey: menuKeys.items(venueId) });
    queryClient.invalidateQueries({ queryKey: menuKeys.packages(venueId) });
  };

  // Category mutations
  const saveCategoryMutation = useMutation({
    mutationFn: async (data: z.infer<typeof zCategoryForm>) => {
      const draft = {
        venueId: editingCategory?.venueId ?? venueId,
        name: data.name.trim(),
        description: data.description,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
        modifierGroups,
      };
      if (editingCategory) {
        return menuService.updateCategory(editingCategory.id, draft);
      } else {
        return menuService.createCategory(draft);
      }
    },
    onSuccess: (_, data) => {
      toast.success(`${data.name} ${editingCategory ? "updated" : "created"}`);
      setCategoryOpen(false);
      invalidate();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not save the category.");
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (category: MenuCategory) => menuService.deleteCategory(category.id),
    onSuccess: (_, category) => {
      toast.info(`${category.name} removed`);
      setCategoryOpen(false);
      invalidate();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not delete the category.");
    },
  });

  // Item mutations
  const toggleItemMutation = useMutation({
    mutationFn: (item: MenuItem) => menuService.updateItem(item.id, { isAvailable: !item.isAvailable }),
    onSuccess: (_, item) => {
      toast.success(`${item.name} ${item.isAvailable ? "86'd" : "back on the menu"}`);
      invalidate();
    },
  });

  const saveItemMutation = useMutation({
    mutationFn: async (data: z.infer<typeof zItemEditForm>) => {
      if (!editing) throw new Error("No item selected");
      return menuService.updateItem(editing.id, {
        name: data.name,
        description: data.description,
        price: data.price,
        isAlcoholic: data.isAlcoholic,
        abv: Number.isNaN(data.abv) || data.abv === undefined ? undefined : data.abv,
        allergens: data.allergens
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
      });
    },
    onSuccess: () => {
      setEditing(null);
      toast.success("Item updated");
      invalidate();
    },
  });

  // Package mutations
  const savePackageMutation = useMutation({
    mutationFn: async (draft: PackageDraft) => {
      const payload = { ...draft, price: draft.priceCents / 100 } as unknown as Omit<BottlePackage, "id">;
      if (editingPackage) {
        return menuService.updatePackage(editingPackage.id, payload);
      } else {
        return menuService.createPackage({ ...payload, venueId: venueId });
      }
    },
    onSuccess: (_, draft) => {
      toast.success(`${draft.name} ${editingPackage ? "updated" : "created"}`);
      invalidate();
    },
  });

  const togglePackageMutation = useMutation({
    mutationFn: (pkg: BottlePackage) => menuService.updatePackage(pkg.id, { isActive: !pkg.isActive }),
    onSuccess: (_, pkg) => {
      toast.success(`${pkg.name} ${pkg.isActive ? "hidden from guests" : "live on the guest menu"}`);
      invalidate();
    },
  });

  const deletePackageMutation = useMutation({
    mutationFn: (pkg: BottlePackage) => menuService.deletePackage(pkg.id),
    onSuccess: (_, pkg) => {
      toast.info(`${pkg.name} removed`);
      invalidate();
    },
  });

  const isSaving = categoryForm.formState.isSubmitting || itemForm.formState.isSubmitting;

  function openCategory(category?: MenuCategory) {
    setEditingCategory(category ?? null);
    if (category) {
      categoryForm.reset({
        name: category.name,
        sortOrder: category.sortOrder,
        description: category.description,
        isActive: category.isActive,
      });
      setModifierGroups(structuredClone(category.modifierGroups));
    } else {
      categoryForm.reset({
        name: "",
        sortOrder: (categories?.length ?? 0) + 1,
        description: "",
        isActive: true,
      });
      setModifierGroups([]);
    }
    setCategoryOpen(true);
  }

  const onCategorySave = categoryForm.handleSubmit(async (data) => {
    saveCategoryMutation.mutate(data);
  });

  const onItemSave = itemForm.handleSubmit(async (data) => {
    saveItemMutation.mutate(data);
  });

  const visibleItems = items.filter((i) => i.categoryId === activeCategory);
  const { sliced: slicedItems, hasMore: itemsHasMore, loadMore: loadMoreItems, reset: resetItems } = useInfiniteSlice(visibleItems, 10);
  const { sliced: slicedPackages, hasMore: pkgsHasMore, loadMore: loadMorePkgs, reset: resetPkgs } = useInfiniteSlice(packages, 10);

  useEffect(() => { resetItems(); }, [activeCategory, resetItems]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Menu"
        description="What guests see — pricing, availability and curated packages."
      />

      {categories === undefined ? (
        <ListSkeleton rows={5} rowHeight="h-20" />
      ) : (
        <Tabs defaultValue="bottles">
          <TabsList>
            <TabsTrigger value="bottles">
              <Martini className="size-3.5" /> Bottles
            </TabsTrigger>
            <TabsTrigger value="packages">
              <Gift className="size-3.5" /> Packages ({packages.length})
            </TabsTrigger>
          </TabsList>

          {/* ---------- Bottles tab ---------- */}
          <TabsContent value="bottles" className="space-y-4 pt-3">
            <div className="flex justify-end gap-2">
              {categories.find((category) => category.id === activeCategory) && (
                <Button variant="outline" onClick={() => openCategory(categories.find((category) => category.id === activeCategory)!)}>
                  <Pencil className="size-4" /> Edit category
                </Button>
              )}
              <Button onClick={() => openCategory()}>
                <Plus className="size-4" /> New category
              </Button>
            </div>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                    activeCategory === cat.id
                      ? "border-primary bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground",
                    !cat.isActive && "opacity-50",
                  )}
                >
                  {cat.name}
                  {!cat.isActive && " (hidden)"}
                </button>
              ))}
            </div>

            {visibleItems.length === 0 ? (
              <EmptyState
                icon={Martini}
                title="No bottles in this category"
                description="Add bottles to make them orderable from the guest menu."
              />
            ) : (
              <>
              <div className="grid gap-2.5 lg:grid-cols-2">
                {slicedItems.map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    actions={
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col items-center gap-0.5">
                          <ConfirmDialog
                            trigger={
                              <Switch checked={item.isAvailable} aria-label="Toggle availability" />
                            }
                            title={item.isAvailable ? `86 ${item.name}?` : `Put ${item.name} back on the menu?`}
                            description={
                              item.isAvailable
                                ? "Guests can no longer order it, regardless of stock."
                                : "Guests can order it again while stock lasts."
                            }
                            confirmLabel={item.isAvailable ? "86 it" : "Make it live"}
                            onConfirm={() => toggleItemMutation.mutate(item)}
                          />
                          <span className="text-[10px] text-muted-foreground">
                            {item.isAvailable ? "Live" : "86'd"}
                          </span>
                        </div>
                        <TooltipIconButton
                          variant="ghost"
                          onClick={() => { setEditing(item); itemForm.reset({ name: item.name, description: item.description, price: item.price, isAlcoholic: item.isAlcoholic, abv: item.abv, allergens: item.allergens.join(", ") }); }}
                          tooltip="Edit item"
                        >
                          <Pencil className="size-4" />
                        </TooltipIconButton>
                      </div>
                    }
                  />
                ))}
              </div>
              <InfiniteScrollSentinel onLoadMore={loadMoreItems} hasMore={itemsHasMore} />
              </>
            )}
          </TabsContent>

          {/* ---------- Packages tab ---------- */}
          <TabsContent value="packages" className="space-y-4 pt-3">
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setEditingPackage(null);
                  setEditorOpen(true);
                }}
              >
                <Plus className="size-4" /> New package
              </Button>
            </div>

            {packages.length === 0 ? (
              <EmptyState
                icon={Gift}
                title="No packages yet"
                description="Bundle bottles into a package guests can order in one tap."
              />
            ) : (
              <>
              <div className="grid gap-3 lg:grid-cols-2">
                {slicedPackages.map((pkg) => (
                  <Card key={pkg.id} className={`py-4 ${pkg.isActive ? "" : "opacity-60"}`}>
                    <CardContent className="space-y-3 px-4">
                      <div className="flex items-start gap-3">
                        <BottleIcon icon="package" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{pkg.name}</p>
                            {!pkg.isActive && <Badge variant="outline">Hidden</Badge>}
                            {pkg.quote.maxQuantity === 0 && (
                              <Badge
                                variant="outline"
                                className="text-red-600 dark:text-red-400"
                              >
                                Out of stock
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{pkg.description}</p>
                        </div>
                      </div>

                      <ul className="space-y-1 rounded-lg bg-accent/50 p-3 text-xs">
                        {pkg.quote.lines.map((line) => (
                          <li key={line.menuItemId} className="flex justify-between">
                            <span>
                              {line.quantity}× {line.name}
                            </span>
                            <span className="tabular-nums text-muted-foreground">
                              {formatMoney(line.unitPrice * line.quantity)}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <div className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-bold tabular-nums">{formatMoney(pkg.price)}</p>
                          <p className="text-xs text-muted-foreground">
                            Value {formatMoney(pkg.quote.componentsValue)} · guest saves{" "}
                            {formatMoney(pkg.quote.savings)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Stock supports {pkg.quote.maxQuantity} more tonight
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <ConfirmDialog
                            trigger={<Switch checked={pkg.isActive} aria-label="Toggle package" />}
                            title={pkg.isActive ? `Hide ${pkg.name} from guests?` : `Publish ${pkg.name}?`}
                            description={
                              pkg.isActive
                                ? "The package disappears from the guest menu."
                                : "The package goes live on the guest menu."
                            }
                            confirmLabel={pkg.isActive ? "Hide package" : "Publish"}
                            onConfirm={() => togglePackageMutation.mutate(pkg)}
                          />
                          <TooltipIconButton
                            variant="ghost"
                            tooltip="Edit package"
                            onClick={() => {
                              setEditingPackage(pkg);
                              setEditorOpen(true);
                            }}
                          >
                            <Pencil className="size-4" />
                          </TooltipIconButton>
                          <ConfirmDialog
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                                aria-label="Delete package"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            }
                            title={`Delete ${pkg.name}?`}
                            description="Guests will no longer be able to order this package. Past orders keep their history."
                            confirmLabel="Delete package"
                            destructive
                            onConfirm={() => deletePackageMutation.mutate(pkg)}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <InfiniteScrollSentinel onLoadMore={loadMorePkgs} hasMore={pkgsHasMore} />
              </>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* ---------- Category edit dialog ---------- */}
      <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
        <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCategory ? `Edit ${editingCategory.name}` : "New category"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onCategorySave} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
                <div className="space-y-1.5">
                  <Label htmlFor="category-name">Name</Label>
                  <Input id="category-name" {...categoryForm.register("name")} />
                  {categoryForm.formState.errors.name && <p className="text-xs text-destructive">{categoryForm.formState.errors.name.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="category-order">Sort order</Label>
                  <Input id="category-order" type="number" min={1} {...categoryForm.register("sortOrder", { valueAsNumber: true })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category-description">Description</Label>
                <Textarea id="category-description" {...categoryForm.register("description")} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div><p className="text-sm font-medium">Active</p><p className="text-xs text-muted-foreground">Visible on the guest menu</p></div>
                <Switch checked={categoryForm.watch("isActive")} onCheckedChange={(v) => categoryForm.setValue("isActive", v)} />
              </div>
              <ModifierPresetEditor
                value={modifierGroups}
                onChange={setModifierGroups}
                inventoryItems={items}
              />
            <DialogFooter className="sm:justify-between">
            <div>
              {editingCategory && (
                <ConfirmDialog
                  trigger={<Button variant="destructive">Delete category</Button>}
                  title={`Delete ${editingCategory.name}?`}
                  description="Categories with bottles cannot be deleted. Past orders keep their snapshots."
                  confirmLabel="Delete category"
                  destructive
                  onConfirm={() => deleteCategoryMutation.mutate(editingCategory)}
                />
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setCategoryOpen(false)} disabled={isSaving}>Cancel</Button>
              <Button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save category"}</Button>
            </div>
          </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---------- Item edit dialog ---------- */}
      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit bottle</DialogTitle>
          </DialogHeader>
          {editing && (
            <form onSubmit={onItemSave} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">Name</Label>
                <Input id="edit-name" {...itemForm.register("name")} />
                {itemForm.formState.errors.name && <p className="text-xs text-destructive">{itemForm.formState.errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-desc">Description</Label>
                <Textarea id="edit-desc" rows={2} {...itemForm.register("description")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-price">Price ($ CAD)</Label>
                <Input id="edit-price" type="number" min={0} step={5} {...itemForm.register("price", { valueAsNumber: true })} />
                {itemForm.formState.errors.price && <p className="text-xs text-destructive">{itemForm.formState.errors.price.message}</p>}
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5 pr-4">
                  <Label htmlFor="edit-alcoholic">Contains alcohol</Label>
                  <p className="text-xs text-muted-foreground">
                    Counts toward each guest&apos;s responsible-service drink total.
                  </p>
                </div>
                <Controller
                  control={itemForm.control}
                  name="isAlcoholic"
                  render={({ field }) => (
                    <Switch
                      id="edit-alcoholic"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label="Contains alcohol"
                    />
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-abv">ABV (%)</Label>
                <Input
                  id="edit-abv"
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  placeholder="e.g. 40"
                  {...itemForm.register("abv", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-allergens">Allergens</Label>
                <Input id="edit-allergens" placeholder="nuts, dairy" {...itemForm.register("allergens")} />
                <p className="text-xs text-muted-foreground">
                  Comma-separated. Shown to guests on the item — leave blank if none are declared.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Stock levels are managed in Inventory — restocks and corrections happen there.
              </p>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ---------- Package editor ---------- */}
      <PackageEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        pkg={editingPackage}
        items={items}
        onSave={async (draft) => { await savePackageMutation.mutateAsync(draft); }}
      />
    </div>
  );
}

export default function ManagerMenuPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={5} rowHeight="h-20" />}>
      <MenuContent />
    </Suspense>
  );
}
