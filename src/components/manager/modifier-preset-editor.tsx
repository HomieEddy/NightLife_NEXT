"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import type { MenuItem, ModifierGroup, ModifierKind } from "@/lib/types";

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function ModifierPresetEditor({
  value,
  onChange,
  inventoryItems,
}: {
  value: ModifierGroup[];
  onChange: (value: ModifierGroup[]) => void;
  inventoryItems: MenuItem[];
}) {
  function addGroup(kind: ModifierKind) {
    onChange([
      ...value,
      {
        id: id("group"),
        name: kind === "washer" ? "Washers" : "Presentation",
        kind,
        required: false,
        maxSelections: 1,
        isActive: true,
        options: [],
      },
    ]);
  }

  function updateGroup(index: number, patch: Partial<ModifierGroup>) {
    onChange(value.map((group, position) => position === index ? { ...group, ...patch } : group));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label>Add-on presets</Label>
          <p className="text-xs text-muted-foreground">
            Category presets apply to every bottle in the category.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => addGroup("washer")}>
            <Plus className="size-3.5" /> Washers
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => addGroup("presentation")}>
            <Plus className="size-3.5" /> Presentation
          </Button>
        </div>
      </div>

      {value.map((group, groupIndex) => (
        <div key={group.id} className="space-y-3 rounded-xl border bg-accent/20 p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_8rem_auto_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor={`${group.id}-name`}>{group.kind === "washer" ? "Washer" : "Presentation"} group</Label>
              <Input
                id={`${group.id}-name`}
                value={group.name}
                onChange={(event) => updateGroup(groupIndex, { name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${group.id}-max`}>Distinct choices</Label>
              <Input
                id={`${group.id}-max`}
                type="number"
                min={1}
                max={20}
                value={group.maxSelections}
                onChange={(event) => updateGroup(groupIndex, { maxSelections: Math.max(1, Number(event.target.value)) })}
              />
            </div>
            <label className="flex h-9 items-center gap-2 text-sm">
              <Switch
                checked={group.required}
                onCheckedChange={(required) => updateGroup(groupIndex, { required })}
              />
              Required
            </label>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onChange(value.filter((_, position) => position !== groupIndex))}
              aria-label={`Remove ${group.name}`}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>

          <div className="space-y-2">
            {group.options.map((option, optionIndex) => (
              <div key={option.id} className="grid gap-2 sm:grid-cols-[1fr_7rem_7rem_1fr_auto]">
                <Input
                  aria-label="Option name"
                  placeholder="Option name"
                  value={option.name}
                  onChange={(event) => updateGroup(groupIndex, {
                    options: group.options.map((entry, position) => position === optionIndex ? { ...entry, name: event.target.value } : entry),
                  })}
                />
                <Input
                  aria-label="Price per unit"
                  type="number"
                  min={0}
                  step={1}
                  value={option.priceDelta}
                  onChange={(event) => updateGroup(groupIndex, {
                    options: group.options.map((entry, position) => position === optionIndex ? { ...entry, priceDelta: Number(event.target.value) } : entry),
                  })}
                />
                <Input
                  aria-label="Maximum quantity"
                  type="number"
                  min={1}
                  max={99}
                  value={option.maxQuantity}
                  onChange={(event) => updateGroup(groupIndex, {
                    options: group.options.map((entry, position) => position === optionIndex ? { ...entry, maxQuantity: Math.max(1, Number(event.target.value)) } : entry),
                  })}
                />
                {group.kind === "washer" ? (
                  <Select
                    value={option.inventoryItemId ?? "none"}
                    onValueChange={(inventoryItemId) => updateGroup(groupIndex, {
                      options: group.options.map((entry, position) => position === optionIndex
                        ? { ...entry, inventoryItemId: inventoryItemId === "none" ? undefined : inventoryItemId }
                        : entry),
                    })}
                  >
                    <SelectTrigger aria-label="Inventory item"><SelectValue placeholder="No stock link" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No stock link</SelectItem>
                      {inventoryItems.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : <div />}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => updateGroup(groupIndex, { options: group.options.filter((_, position) => position !== optionIndex) })}
                  aria-label={`Remove ${option.name || "option"}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => updateGroup(groupIndex, {
                options: [...group.options, {
                  id: id("option"),
                  name: "",
                  priceDelta: 0,
                  maxQuantity: 1,
                  isActive: true,
                }],
              })}
            >
              <Plus className="size-3.5" /> Add option
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
