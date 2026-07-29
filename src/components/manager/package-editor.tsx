"use client";

import { useEffect, useMemo } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/features/shared/format";
import { ModifierPresetEditor } from "@/components/manager/modifier-preset-editor";
import { zPackageInput } from "@/features/menu/schemas";
import type { BottlePackage, MenuItem, ModifierGroup, PackageComponent } from "@/lib/types";
import type { z } from "zod";

export interface PackageDraft {
  name: string;
  description: string;
  priceCents: number;
  isActive: boolean;
  components: PackageComponent[];
  modifierGroups: ModifierGroup[];
}

type FormValues = z.input<typeof zPackageInput>;

/** Create/edit dialog for bottle packages. Pass `pkg` to edit, omit to create. */
export function PackageEditor({
  open,
  onOpenChange,
  pkg,
  items,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pkg: BottlePackage | null;
  items: MenuItem[];
  onSave: (draft: PackageDraft) => Promise<void>;
}) {
  const { register, control, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting: saving } } = useForm({
    resolver: zodResolver(zPackageInput),
    defaultValues: { name: "", description: "", priceCents: 0, components: [], isActive: true, modifierGroups: [] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "components" });
  const priceCents = watch("priceCents");
  const isActive = watch("isActive");
  const modifierGroups = watch("modifierGroups");

  const componentsValue = useMemo(
    () =>
      fields.reduce((sum, component) => {
        const item = items.find((i) => i.id === component.menuItemId);
        return sum + (item ? item.price * component.quantity : 0);
      }, 0),
    [fields, items],
  );

  const unusedItems = items.filter(
    (item) => !fields.some((c) => c.menuItemId === item.id),
  );

  useEffect(() => {
    if (open) {
      reset(
        pkg
          ? {
              name: pkg.name,
              description: pkg.description,
              priceCents: Math.round(pkg.price * 100),
              components: pkg.components.map((c) => ({ ...c })),
              isActive: pkg.isActive,
              modifierGroups: structuredClone(pkg.modifierGroups),
            }
          : { name: "", description: "", priceCents: 0, components: [], isActive: true, modifierGroups: [] },
      );
    }
  }, [open, pkg, reset]);

  const onFormSave = handleSubmit(async (data) => {
    await onSave({
      name: data.name.trim(),
      description: data.description,
      priceCents: data.priceCents,
      components: data.components,
      isActive: data.isActive ?? true,
      modifierGroups: data.modifierGroups ?? [],
    });
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{pkg ? `Edit ${pkg.name}` : "New package"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onFormSave} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pkg-name">Name</Label>
              <Input id="pkg-name" placeholder="e.g. Mr Ace" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pkg-price">Package price ($ CAD)</Label>
              <Input
                id="pkg-price"
                type="number"
                min={0}
                step={10}
                value={priceCents ? (priceCents / 100).toString() : ""}
                onChange={(e) => setValue("priceCents", Math.round(parseFloat(e.target.value) * 100) || 0, { shouldValidate: true })}
              />
              {errors.priceCents && <p className="text-xs text-destructive">{errors.priceCents.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pkg-desc">Description</Label>
            <Textarea
              id="pkg-desc"
              rows={2}
              placeholder="What makes this package special?"
              {...register("description")}
            />
          </div>

          <div className="space-y-2">
            <Label>Bottles in this package</Label>
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-2">
                <Select
                  value={watch(`components.${index}.menuItemId`)}
                  onValueChange={(value) => setValue(`components.${index}.menuItemId`, value)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {items
                      .filter(
                        (item) =>
                          item.id === watch(`components.${index}.menuItemId`) ||
                          !fields.some((c, i) => i !== index && c.menuItemId === item.id),
                      )
                      .map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} · {formatMoney(item.price)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={1}
                  max={99}
                  className="w-18"
                  {...register(`components.${index}.quantity`, { valueAsNumber: true })}
                  aria-label="Quantity"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                  onClick={() => remove(index)}
                  aria-label="Remove bottle"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            {errors.components?.root && <p className="text-xs text-destructive">{errors.components.root.message}</p>}
            {errors.components && Array.isArray(errors.components) ? null : errors.components?.message && <p className="text-xs text-destructive">{String(errors.components.message)}</p>}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={unusedItems.length === 0}
              onClick={() =>
                append({ menuItemId: unusedItems[0].id, quantity: 1 })
              }
            >
              <Plus className="size-3.5" /> Add bottle
            </Button>
          </div>

          <ModifierPresetEditor
            value={modifierGroups ?? []}
            onChange={(v) => setValue("modifierGroups", v as any)}
            inventoryItems={items}
          />

          {componentsValue > 0 && (
            <div className="rounded-lg border bg-accent/40 p-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>À la carte value</span>
                <span className="tabular-nums">{formatMoney(componentsValue)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Guest saves</span>
                <span className="tabular-nums">
                  {formatMoney(Math.max(0, componentsValue - (priceCents / 100)))}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">Visible on the guest menu</p>
            </div>
            <Switch
              checked={isActive}
              onCheckedChange={(checked) => setValue("isActive", checked)}
            />
          </div>
        </form>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? "Saving…" : pkg ? "Save changes" : "Create package"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
