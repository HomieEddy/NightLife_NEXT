"use client";

import { FeatureGate } from "@/components/shared/feature-gate";

import { Suspense, useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Tag, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { promotionsService } from "@/features/hospitality/promotions-service";
import { menuService } from "@/features/menu/services";
import { SearchInput } from "@/components/shared/search-input";
import { cn } from "@/features/shared/utils";
import { zPromotionInput } from "@/lib/form-schemas";
import type { MenuCategory, Promotion, PromotionStatus } from "@/lib/types";
import type { z } from "zod";

const selectCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}
function fromLocalInput(value: string): string {
  return new Date(value).toISOString();
}

type FormValues = z.infer<typeof zPromotionInput>;
const EMPTY_VALUES: FormValues = {
  code: "",
  name: "",
  type: "pct",
  value: 10,
  appliesToCategoryIds: [],
  startsAt: toLocalInput(new Date().toISOString()),
  endsAt: toLocalInput(new Date(Date.now() + 30 * 86400_000).toISOString()),
  status: "scheduled",
};

function PromotionsContent() {
  const [promos, setPromos] = useState<Promotion[] | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [statusFilter, setStatusFilter] = useState<PromotionStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testCode, setTestCode] = useState("");
  const [testResult, setTestResult] = useState<Promotion | null | undefined>(undefined);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(zPromotionInput),
    defaultValues: EMPTY_VALUES,
  });
  const appliesToCategoryIds = watch("appliesToCategoryIds");

  const refresh = useCallback(async () => {
    const [list, cats] = await Promise.all([
      promotionsService.listPromotions(),
      menuService.listCategories(true),
    ]);
    setPromos(list);
    setCategories(cats);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;

  async function runTestCode() {
    const result = await promotionsService.validateCode(testCode);
    setTestResult(result);
    if (result) toast.success(`Valid: ${result.name}`);
    else if (testCode.trim()) toast.error("No active promotion for that code.");
  }

  function toggleCat(id: string) {
    setValue("appliesToCategoryIds",
      (appliesToCategoryIds ?? []).includes(id)
        ? (appliesToCategoryIds ?? []).filter((x) => x !== id)
        : [...(appliesToCategoryIds ?? []), id],
    );
  }

  function openCreate() {
    setEditingId(null);
    reset(EMPTY_VALUES);
    setDialogOpen(true);
  }

  function openEdit(p: Promotion) {
    setEditingId(p.id);
    reset({
      code: p.code,
      name: p.name,
      type: p.type === "percentage" ? "pct" : ("flat" as FormValues["type"]),
      value: p.value,
      appliesToCategoryIds: p.appliesToCategoryIds,
      startsAt: toLocalInput(p.startsAt),
      endsAt: toLocalInput(p.endsAt),
      status: (p.status === "expired" ? "inactive" : p.status) as FormValues["status"],
    });
    setDialogOpen(true);
  }

  const onSave = handleSubmit(async (data) => {
    const payload = {
      code: data.code.trim().toUpperCase(),
      name: data.name.trim(),
      type: data.type === "pct" ? "percentage" as const : "flat" as const,
      value: data.value,
      appliesToCategoryIds: data.appliesToCategoryIds ?? [],
      startsAt: fromLocalInput(data.startsAt),
      endsAt: fromLocalInput(data.endsAt),
      status: data.status as PromotionStatus,
    };
    if (editingId) {
      await promotionsService.updatePromotion(editingId, payload);
      toast.success("Promotion updated");
    } else {
      await promotionsService.createPromotion(payload);
      toast.success("Promotion created");
    }
    setDialogOpen(false);
    await refresh();
  });

  async function remove(p: Promotion) {
    await promotionsService.deletePromotion(p.id);
    toast.info(`${p.name} deleted`);
    await refresh();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Promotions"
        description="Promo codes and discounts applied at checkout."
        breadcrumbs={[{ label: "Catalogue", href: "/manager/menu" }, { label: "Promotions" }]}
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> New promotion
          </Button>
        }
      />

      <Card className="py-4">
        <CardContent className="flex flex-wrap items-end gap-2 px-4">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="test-code">Test a code</Label>
            <Input
              id="test-code"
              placeholder="e.g. WELCOME10"
              value={testCode}
              onChange={(e) => {
                setTestCode(e.target.value);
                setTestResult(undefined);
              }}
            />
          </div>
          <Button onClick={runTestCode}>
            <CheckCircle2 className="size-4" /> Validate
          </Button>
          {testResult === null && testCode.trim() && (
            <span className="text-sm text-muted-foreground">No active promotion.</span>
          )}
          {testResult && (
            <span className="text-sm text-emerald-600 dark:text-emerald-400">
              {testResult.name} — {testResult.type === "percentage" ? `−${testResult.value}%` : `−${testResult.value}$`}
            </span>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search by code or name…"
          className="w-full sm:w-56"
        />
        <div className="flex flex-wrap gap-1.5">
          {(["all", "active", "scheduled", "expired"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
                statusFilter === s
                  ? "border-primary bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>
      </div>

      {promos === null ? (
        <ListSkeleton rows={3} rowHeight="h-28" />
      ) : (() => {
        const visible = promos.filter((p) => {
          if (statusFilter !== "all" && p.status !== statusFilter) return false;
          if (query.trim()) {
            const q = query.trim().toLowerCase();
            if (!`${p.code} ${p.name}`.toLowerCase().includes(q)) return false;
          }
          return true;
        });
        if (visible.length === 0) return (
          <EmptyState
            icon={Tag}
            title="No promotions match"
            description={promos.length === 0 ? "Create a promo code to discount orders at checkout." : "Try adjusting the filters."}
          />
        );
        return (
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map((p) => (
            <Card key={p.id} className="py-4">
              <CardContent className="space-y-3 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <Tag className="size-5" />
                    </div>
                    <div>
                      <p className="font-mono text-sm font-semibold">{p.code}</p>
                      <p className="text-xs text-muted-foreground">{p.name}</p>
                    </div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <p className="text-sm">
                  {p.type === "percentage" ? `−${p.value}%` : `−${p.value}$`} · {p.redemptionCount} redemptions
                </p>
                <p className="text-xs text-muted-foreground">
                  Applies to: {p.appliesToCategoryIds.length === 0 ? "All categories" : p.appliesToCategoryIds.map(catName).join(", ")}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 border-t pt-2">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                    <Pencil className="size-3.5" /> Edit
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400">
                        <Trash2 className="size-3.5" /> Delete
                      </Button>
                    }
                    title={`Delete ${p.code}?`}
                    description="The promo code stops applying immediately."
                    confirmLabel="Delete promotion"
                    destructive
                    onConfirm={() => remove(p)}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        );
      })()}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85dvh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit promotion" : "New promotion"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="promo-code">Code</Label>
                <Input id="promo-code" {...register("code")} placeholder="WELCOME10" />
                {errors.code && <p className="text-xs text-red-600">{errors.code.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="promo-status">Status</Label>
                <select id="promo-status" className={selectCls} value={watch("status")} onChange={(e) => setValue("status", e.target.value as FormValues["status"])}>
                  <option value="scheduled">Scheduled</option>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-name">Name</Label>
              <Input id="promo-name" {...register("name")} />
              {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="promo-type">Type</Label>
                <select id="promo-type" className={selectCls} value={watch("type")} onChange={(e) => setValue("type", e.target.value as FormValues["type"])}>
                  <option value="pct">Percentage</option>
                  <option value="flat">Flat amount</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="promo-value">{watch("type") === "pct" ? "Percent" : "Amount ($)"}</Label>
                <Input id="promo-value" type="number" min={0} {...register("value", { valueAsNumber: true })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="promo-start">Starts</Label>
                <Input id="promo-start" type="datetime-local" {...register("startsAt")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="promo-end">Ends</Label>
                <Input id="promo-end" type="datetime-local" {...register("endsAt")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Applies to categories</Label>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCat(c.id)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors",
                      (appliesToCategoryIds ?? []).includes(c.id)
                        ? "border-primary bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">None selected = applies to all categories.</p>
            </div>
          <DialogFooter>
            <Button variant="ghost" type="button" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {isSubmitting ? "Saving…" : editingId ? "Save" : "Create promotion"}
            </Button>
          </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ManagerPromotionsPage() {
  return (
    <FeatureGate feature="promotions">
      <Suspense fallback={<ListSkeleton rows={3} rowHeight="h-28" />}>
        <PromotionsContent />
      </Suspense>
    </FeatureGate>
  );
}
