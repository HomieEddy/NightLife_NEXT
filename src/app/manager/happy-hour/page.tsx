"use client";

import { FeatureGate } from "@/components/shared/feature-gate";

import { Suspense, useState } from "react";
import { Clock, Loader2, Pencil, Percent, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { EntityChip } from "@/components/shared/entity-chip";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { menuService } from "@/features/menu/services";
import { menuKeys } from "@/features/menu/query-keys";
import { SearchInput } from "@/components/shared/search-input";
import { useHighlight } from "@/lib/use-highlight";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/features/shared/utils";
import { zHappyHourInput } from "@/lib/form-schemas";
import type { HappyHourRule } from "@/lib/types";
import type { z } from "zod";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type FormValues = z.infer<typeof zHappyHourInput>;
const EMPTY_VALUES: FormValues = {
  name: "",
  daysOfWeek: [4, 5, 6],
  startTime: "22:00",
  endTime: "23:30",
  discountPct: 20,
  appliesToCategoryIds: [],
  isActive: true,
};

function HappyHourContent() {
  const { user } = useAuth();
  const venueId = user?.venueId ?? "";
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [dayFilter, setDayFilter] = useState<number | "all">("all");
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const highlightedCategory = useHighlight("category");

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(zHappyHourInput),
    defaultValues: EMPTY_VALUES,
  });
  const daysOfWeek = watch("daysOfWeek");
  const appliesToCategoryIds = watch("appliesToCategoryIds");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: menuKeys.happyHour(venueId) });
  };

  const { data: rules } = useQuery({
    queryKey: menuKeys.happyHour(venueId),
    queryFn: () => menuService.listHappyHourRules(),
    enabled: !!venueId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: menuKeys.categories(venueId),
    queryFn: () => menuService.listCategories(true),
    enabled: !!venueId,
  });

  const toggleMutation = useMutation({
    mutationFn: (rule: HappyHourRule) => menuService.toggleHappyHourRule(rule.id),
    onSuccess: (_, rule) => {
      toast.success(`${rule.name} ${rule.isActive ? "deactivated" : "activated"}`);
      invalidate();
    },
    onError: () => toast.error("Could not toggle rule"),
  });

  const saveMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const input: Parameters<typeof menuService.createHappyHourRule>[0] = {
        ...data,
        name: data.name.trim(),
        isActive: data.isActive ?? true,
      };
      if (editingId) {
        await menuService.updateHappyHourRule(editingId, input);
        return `${input.name} updated`;
      } else {
        await menuService.createHappyHourRule(input);
        return `${input.name} created`;
      }
    },
    onSuccess: (message) => {
      toast.success(message);
      setDialogOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const removeMutation = useMutation({
    mutationFn: (rule: HappyHourRule) => menuService.deleteHappyHourRule(rule.id),
    onSuccess: (_, rule) => {
      toast.info(`${rule.name} deleted`);
      invalidate();
    },
  });

  function openCreate() {
    setEditingId(null);
    reset(EMPTY_VALUES);
    setDialogOpen(true);
  }

  function openEdit(rule: HappyHourRule) {
    setEditingId(rule.id);
    reset({
      name: rule.name,
      daysOfWeek: rule.daysOfWeek,
      startTime: rule.startTime,
      endTime: rule.endTime,
      discountPct: rule.discountPct,
      appliesToCategoryIds: rule.appliesToCategoryIds,
      isActive: rule.isActive,
    });
    setDialogOpen(true);
  }

  function toggleDraftDay(day: number) {
    setValue("daysOfWeek",
      daysOfWeek.includes(day)
        ? daysOfWeek.filter((x) => x !== day)
        : [...daysOfWeek, day].sort(),
    );
  }

  function toggleDraftCategory(id: string) {
    setValue("appliesToCategoryIds",
      appliesToCategoryIds.includes(id)
        ? appliesToCategoryIds.filter((x) => x !== id)
        : [...appliesToCategoryIds, id],
    );
  }

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;

  const visible = (rules ?? []).filter((rule) => {
    if (activeFilter === "active" && !rule.isActive) return false;
    if (activeFilter === "inactive" && rule.isActive) return false;
    if (dayFilter !== "all" && !rule.daysOfWeek.includes(dayFilter)) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      const haystack = [rule.name, ...rule.appliesToCategoryIds.map(categoryName)].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Happy hour"
        description="Time-based discounts, applied automatically to guest orders."
        breadcrumbs={[{ label: "Catalogue", href: "/manager/menu" }, { label: "Happy Hour" }]}
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> New rule
          </Button>
        }
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search rules…"
            className="w-full sm:w-56"
          />
          <div className="flex flex-wrap gap-1.5">
            {(["all", "active", "inactive"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setActiveFilter(s)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
                  activeFilter === s
                    ? "border-primary bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s === "all" ? "All" : s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setDayFilter("all")}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              dayFilter === "all"
                ? "border-primary bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            All days
          </button>
          {DAY_LABELS.map((label, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setDayFilter(i)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                dayFilter === i
                  ? "border-primary bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {rules === undefined ? (
        <ListSkeleton rows={3} rowHeight="h-32" />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No rules match"
          description={rules.length === 0 ? "Create a rule to discount categories during set hours." : "Try adjusting the filters."}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map((rule) => (
            <Card
              key={rule.id}
              id={`highlight-${rule.id}`}
              className={cn(
                "py-4 transition-shadow",
                !rule.isActive && "opacity-60",
                highlightedCategory !== null &&
                  rule.appliesToCategoryIds.includes(highlightedCategory) &&
                  "ring-2 ring-primary shadow-lg",
              )}
            >
              <CardContent className="space-y-3 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <Percent className="size-5" />
                    </div>
                    <div>
                      <p className="font-medium">{rule.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {rule.startTime} – {rule.endTime} · −{rule.discountPct}%
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <ConfirmDialog
                      trigger={<Switch checked={rule.isActive} aria-label="Toggle rule" />}
                      title={rule.isActive ? `Deactivate ${rule.name}?` : `Activate ${rule.name}?`}
                      description={
                        rule.isActive
                          ? "The discount stops applying to guest orders."
                          : `Guests get −${rule.discountPct}% on the selected categories during the set hours.`
                      }
                      confirmLabel={rule.isActive ? "Deactivate" : "Activate"}
                      onConfirm={() => toggleMutation.mutate(rule)}
                    />
                    <Button variant="ghost" size="icon" aria-label="Edit rule" onClick={() => openEdit(rule)}>
                      <Pencil className="size-4" />
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                          aria-label="Delete rule"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      }
                      title={`Delete ${rule.name}?`}
                      description="The discount stops applying immediately."
                      confirmLabel="Delete rule"
                      destructive
                      onConfirm={() => removeMutation.mutate(rule)}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {DAY_LABELS.map((day, i) => (
                    <span
                      key={day}
                      className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${
                        rule.daysOfWeek.includes(i)
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "text-muted-foreground/50"
                      }`}
                    >
                      {day}
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  Applies to:
                  {rule.appliesToCategoryIds.map((id) => (
                    <EntityChip key={id} type="menu-category" id={id} label={categoryName(id)} />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Prototype note: discounts are not yet applied to guest cart pricing.
      </p>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85dvh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit rule" : "New happy hour rule"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="rule-name">Name</Label>
              <Input id="rule-name" placeholder="e.g. Early bird bottles" {...register("name")} />
              {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rule-start">Start</Label>
                <Input id="rule-start" type="time" {...register("startTime")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rule-end">End</Label>
                <Input id="rule-end" type="time" {...register("endTime")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rule-pct">Discount %</Label>
                <Input id="rule-pct" type="number" min={1} max={90} {...register("discountPct", { valueAsNumber: true })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Days</Label>
              <div className="flex flex-wrap gap-1.5">
                {DAY_LABELS.map((day, i) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDraftDay(i)}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs transition-colors",
                      daysOfWeek.includes(i)
                        ? "border-primary bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Applies to categories</Label>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleDraftCategory(cat.id)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors",
                      appliesToCategoryIds.includes(cat.id)
                        ? "border-primary bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" type="button" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                {saveMutation.isPending ? "Saving…" : editingId ? "Save" : "Create rule"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ManagerHappyHourPage() {
  return (
    <FeatureGate feature="happy-hour">
      <Suspense fallback={<ListSkeleton rows={3} rowHeight="h-32" />}>
        <HappyHourContent />
      </Suspense>
    </FeatureGate>
  );
}
