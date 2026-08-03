"use client";

import { FeatureGate } from "@/components/shared/feature-gate";
import { useTranslations } from "next-intl";
import { Suspense, useState } from "react";
import { Loader2, Pencil, Plus, Tag, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { promotionsKeys } from "@/features/hospitality/query-keys";
import { menuKeys } from "@/features/menu/query-keys";
import { SearchInput } from "@/components/shared/search-input";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/features/shared/utils";
import { zPromotionInput } from "@/lib/form-schemas";
import type { Promotion, PromotionStatus } from "@/lib/types";
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
  const t = useTranslations("manager.promotions");
  const { user } = useAuth();
  const venueId = user?.venueId ?? "";
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<PromotionStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testCode, setTestCode] = useState("");
  const [testResult, setTestResult] = useState<Promotion | null | undefined>(undefined);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(zPromotionInput),
    defaultValues: EMPTY_VALUES,
  });
  const appliesToCategoryIds = watch("appliesToCategoryIds");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: promotionsKeys.all(venueId) });
  };

  const { data: promos } = useQuery({
    queryKey: promotionsKeys.all(venueId),
    queryFn: () => promotionsService.listPromotions(),
    enabled: !!venueId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: menuKeys.categories(venueId),
    queryFn: () => menuService.listCategories(true),
    enabled: !!venueId,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: FormValues) => {
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
        return t("updatedToast");
      } else {
        await promotionsService.createPromotion(payload);
        return t("createdToast");
      }
    },
    onSuccess: (message) => {
      toast.success(message);
      setDialogOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("saveFailed")),
  });

  const removeMutation = useMutation({
    mutationFn: (p: Promotion) => promotionsService.deletePromotion(p.id),
    onSuccess: (_, p) => {
      toast.info(t("deletedToast", { name: p.name }));
      invalidate();
    },
  });

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;

  async function runTestCode() {
    const result = await promotionsService.validateCode(testCode);
    setTestResult(result);
    if (result) toast.success(t("testValid", { name: result.name }));
    else if (testCode.trim()) toast.error(t("testNoMatchToast"));
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

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: t("breadcrumbCatalogue"), href: "/manager/menu" }, { label: t("breadcrumbPromotions") }]}
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> {t("newPromotion")}
          </Button>
        }
      />

      <Card className="py-4">
        <CardContent className="flex flex-wrap items-end gap-2 px-4">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="test-code">{t("testCode")}</Label>
            <Input
              id="test-code"
              placeholder={t("testPlaceholder")}
              value={testCode}
              onChange={(e) => {
                setTestCode(e.target.value);
                setTestResult(undefined);
              }}
            />
          </div>
          <Button onClick={runTestCode}>
            <CheckCircle2 className="size-4" /> {t("testButton")}
          </Button>
          {testResult === null && testCode.trim() && (
            <span className="text-sm text-muted-foreground">{t("testNoMatch")}</span>
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
          placeholder={t("searchPlaceholder")}
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
              {s === "all" ? t("all") : s === "active" ? t("active") : s === "scheduled" ? t("scheduled") : t("ended")}
            </button>
          ))}
        </div>
      </div>

      {promos === undefined ? (
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
            title={t("noMatch")}
            description={promos.length === 0 ? t("emptyDesc") : t("noMatchDesc")}
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
                    {p.type === "percentage" ? `−${p.value}%` : `−${p.value}$`} · {t("usageCount", { count: p.redemptionCount })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("appliesTo")} {p.appliesToCategoryIds.length === 0 ? t("allCategories") : p.appliesToCategoryIds.map(catName).join(", ")}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 border-t pt-2">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                      <Pencil className="size-3.5" /> {t("edit")}
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400">
                          <Trash2 className="size-3.5" /> {t("delete")}
                        </Button>
                      }
                      title={t("deleteTitle", { code: p.code })}
                      description={t("deleteDesc")}
                      confirmLabel={t("deleteConfirm")}
                      destructive
                      onConfirm={() => removeMutation.mutate(p)}
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
            <DialogTitle>{editingId ? t("editPromotionTitle") : t("newPromotionTitle")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="promo-code">{t("code")}</Label>
                <Input id="promo-code" {...register("code")} placeholder={t("codePlaceholder")} />
                {errors.code && <p className="text-xs text-red-600">{errors.code.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="promo-status">{t("statusLabel")}</Label>
                <select id="promo-status" className={selectCls} value={watch("status")} onChange={(e) => setValue("status", e.target.value as FormValues["status"])}>
                  <option value="scheduled">{t("scheduled")}</option>
                  <option value="active">{t("active")}</option>
                  <option value="expired">{t("ended")}</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-name">{t("name")}</Label>
              <Input id="promo-name" {...register("name")} />
              {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="promo-type">{t("type")}</Label>
                <select id="promo-type" className={selectCls} value={watch("type")} onChange={(e) => setValue("type", e.target.value as FormValues["type"])}>
                  <option value="pct">{t("typePercentage")}</option>
                  <option value="flat">{t("typeFlat")}</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="promo-value">{watch("type") === "pct" ? t("percent") : t("amount")}</Label>
                <Input id="promo-value" type="number" min={0} {...register("value", { valueAsNumber: true })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="promo-start">{t("starts")}</Label>
                <Input id="promo-start" type="datetime-local" {...register("startsAt")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="promo-end">{t("ends")}</Label>
                <Input id="promo-end" type="datetime-local" {...register("endsAt")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("appliesToCategories")}</Label>
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
              <p className="text-xs text-muted-foreground">{t("appliesToNone")}</p>
            </div>
            <DialogFooter>
              <Button variant="ghost" type="button" onClick={() => setDialogOpen(false)}>{t("cancel")}</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                {saveMutation.isPending ? t("saving") : editingId ? t("save") : t("createPromotion")}
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
