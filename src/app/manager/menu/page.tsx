"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Gift, Loader2, Martini, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { formatMoney } from "@/features/shared/format";
import { cn } from "@/features/shared/utils";
import type { BottlePackage, MenuCategory, MenuItem, ModifierGroup } from "@/lib/types";

type PackageWithQuote = BottlePackage & { quote: PackageQuote };

function MenuContent() {
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<MenuCategory[] | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [packages, setPackages] = useState<PackageWithQuote[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>(
    searchParams.get("category") ?? "",
  );
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<BottlePackage | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);

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
  });

  const categoryForm = useForm({
    resolver: zodResolver(zCategoryForm),
    defaultValues: { name: "", sortOrder: 0, description: "", isActive: true },
  });

  const [editing, setEditing] = useState<MenuItem | null>(null);

  const itemForm = useForm({
    resolver: zodResolver(zItemEditForm),
    defaultValues: { name: "", description: "", price: 0 },
  });

  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);

  const isSaving = categoryForm.formState.isSubmitting || itemForm.formState.isSubmitting;

  const refresh = useCallback(async () => {
    const [cats, its, pkgs] = await Promise.all([
      menuService.listCategories(true),
      menuService.listItems(),
      menuService.listPackages(true),
    ]);
    setCategories(cats);
    setItems(its);
    setPackages(pkgs);
    setActiveCategory((current) => current || cats[0]?.id || "");
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
    try {
      const draft = {
        venueId: editingCategory?.venueId ?? "venue-1",
        name: data.name.trim(),
        description: data.description,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
        modifierGroups,
      };
      if (editingCategory) {
        await menuService.updateCategory(editingCategory.id, draft);
        toast.success(`${data.name} updated`);
      } else {
        await menuService.createCategory(draft);
        toast.success(`${data.name} created`);
      }
      setCategoryOpen(false);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the category.");
    }
  });

  async function removeCategory(category: MenuCategory) {
    try {
      await menuService.deleteCategory(category.id);
      toast.info(`${category.name} removed`);
      setCategoryOpen(false);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the category.");
    }
  }

  // ---------- Items ----------

  async function toggleAvailability(item: MenuItem) {
    await menuService.updateItem(item.id, { isAvailable: !item.isAvailable });
    toast.success(`${item.name} ${item.isAvailable ? "86'd" : "back on the menu"}`);
    await refresh();
  }

  const onItemSave = itemForm.handleSubmit(async (data) => {
    if (!editing) return;
    await menuService.updateItem(editing.id, {
      name: data.name,
      description: data.description,
      price: data.price,
    });
    setEditing(null);
    toast.success("Item updated");
    await refresh();
  });

  // ---------- Packages ----------

  async function savePackage(draft: PackageDraft) {
    const payload = { ...draft, price: draft.priceCents / 100 } as any;
    if (editingPackage) {
      await menuService.updatePackage(editingPackage.id, payload as any);
      toast.success(`${draft.name} updated`);
    } else {
      await menuService.createPackage({ venueId: "venue-1", ...payload } as any);
      toast.success(`${draft.name} created`);
    }
    await refresh();
  }

  async function togglePackage(pkg: BottlePackage) {
    await menuService.updatePackage(pkg.id, { isActive: !pkg.isActive });
    toast.success(`${pkg.name} ${pkg.isActive ? "hidden from guests" : "live on the guest menu"}`);
    await refresh();
  }

  async function removePackage(pkg: BottlePackage) {
    await menuService.deletePackage(pkg.id);
    toast.info(`${pkg.name} removed`);
    await refresh();
  }

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

      {categories === null ? (
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
                            onConfirm={() => toggleAvailability(item)}
                          />
                          <span className="text-[9px] text-muted-foreground">
                            {item.isAvailable ? "Live" : "86'd"}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setEditing(item); itemForm.reset({ name: item.name, description: item.description, price: item.price }); }}
                          aria-label="Edit item"
                        >
                          <Pencil className="size-4" />
                        </Button>
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
                            onConfirm={() => togglePackage(pkg)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Edit package"
                            onClick={() => {
                              setEditingPackage(pkg);
                              setEditorOpen(true);
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
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
                            onConfirm={() => removePackage(pkg)}
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
                  onConfirm={() => removeCategory(editingCategory)}
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
        onSave={savePackage}
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
