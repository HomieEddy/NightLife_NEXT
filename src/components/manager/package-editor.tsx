"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
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
import { formatMoney } from "@/lib/format";
import { ModifierPresetEditor } from "@/components/manager/modifier-preset-editor";
import type { BottlePackage, MenuItem, ModifierGroup, PackageComponent } from "@/lib/types";

export interface PackageDraft {
  name: string;
  description: string;
  price: number;
  isActive: boolean;
  components: PackageComponent[];
  modifierGroups: ModifierGroup[];
}

const EMPTY_DRAFT: PackageDraft = {
  name: "",
  description: "",
  price: 0,
  isActive: true,
  components: [],
  modifierGroups: [],
};

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
  const [draft, setDraft] = useState<PackageDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(
        pkg
          ? {
              name: pkg.name,
              description: pkg.description,
              price: pkg.price,
              isActive: pkg.isActive,
              components: pkg.components.map((c) => ({ ...c })),
              modifierGroups: structuredClone(pkg.modifierGroups),
            }
          : EMPTY_DRAFT,
      );
      setError(null);
    }
  }, [open, pkg]);

  const componentsValue = useMemo(
    () =>
      draft.components.reduce((sum, component) => {
        const item = items.find((i) => i.id === component.menuItemId);
        return sum + (item ? item.price * component.quantity : 0);
      }, 0),
    [draft.components, items],
  );

  const unusedItems = items.filter(
    (item) => !draft.components.some((c) => c.menuItemId === item.id),
  );

  function setComponent(index: number, patch: Partial<PackageComponent>) {
    setDraft((d) => ({
      ...d,
      components: d.components.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));
  }

  async function handleSave() {
    if (!draft.name.trim()) {
      setError("Give the package a name.");
      return;
    }
    if (draft.components.length === 0) {
      setError("Add at least one bottle to the package.");
      return;
    }
    if (draft.price <= 0) {
      setError("Set a package price.");
      return;
    }
    setSaving(true);
    try {
      await onSave({ ...draft, name: draft.name.trim() });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{pkg ? `Edit ${pkg.name}` : "New package"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pkg-name">Name</Label>
              <Input
                id="pkg-name"
                placeholder="e.g. Mr Ace"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pkg-price">Package price ($ CAD)</Label>
              <Input
                id="pkg-price"
                type="number"
                min={0}
                step={10}
                value={draft.price || ""}
                onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pkg-desc">Description</Label>
            <Textarea
              id="pkg-desc"
              rows={2}
              placeholder="What makes this package special?"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Bottles in this package</Label>
            {draft.components.map((component, index) => (
              <div key={component.menuItemId} className="flex items-center gap-2">
                <Select
                  value={component.menuItemId}
                  onValueChange={(value) => setComponent(index, { menuItemId: value })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {items
                      .filter(
                        (item) =>
                          item.id === component.menuItemId ||
                          !draft.components.some((c) => c.menuItemId === item.id),
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
                  value={component.quantity}
                  onChange={(e) =>
                    setComponent(index, { quantity: Math.max(1, Number(e.target.value)) })
                  }
                  aria-label="Quantity"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      components: d.components.filter((_, i) => i !== index),
                    }))
                  }
                  aria-label="Remove bottle"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              disabled={unusedItems.length === 0}
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  components: [...d.components, { menuItemId: unusedItems[0].id, quantity: 1 }],
                }))
              }
            >
              <Plus className="size-3.5" /> Add bottle
            </Button>
          </div>

          <ModifierPresetEditor
            value={draft.modifierGroups}
            onChange={(modifierGroups) => setDraft({ ...draft, modifierGroups })}
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
                  {formatMoney(Math.max(0, componentsValue - draft.price))}
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
              checked={draft.isActive}
              onCheckedChange={(checked) => setDraft({ ...draft, isActive: checked })}
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? "Saving…" : pkg ? "Save changes" : "Create package"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
