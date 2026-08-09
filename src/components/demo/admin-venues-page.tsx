"use client";

import { useTranslations } from "next-intl";

// Plan 10 graduates this demo-only surface.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Ban, Building2, CircleDollarSign, MoreVertical, Play, Rocket, Search, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { adminService } from "@/features/platform/admin-service";
import { adminKeys } from "@/features/platform/query-keys";
import { adminTenantHref } from "@/features/shared/entity-links";
import { formatDate, formatMoney } from "@/features/shared/format";
import type { Tenant, TenantPlan, TenantStatus } from "@/lib/types";

const PLANS: TenantPlan[] = ["starter", "pro", "enterprise"];
const STATUSES: TenantStatus[] = ["active", "trial", "suspended"];

export default function AdminVenuesPage() {
  const t = useTranslations("admin.venues");
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<"all" | TenantPlan>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | TenantStatus>("all");
  const [pendingPlan, setPendingPlan] = useState<{ tenant: Tenant; plan: TenantPlan } | null>(null);

  const { data: tenants } = useQuery({
    queryKey: adminKeys.tenants,
    queryFn: () => adminService.listTenants(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: adminKeys.tenants });
  };

  const visible = useMemo(() => {
    return (tenants ?? []).filter((t) => {
      if (planFilter !== "all" && t.plan !== planFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        if (![t.venueName, t.slug, t.city].join(" ").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [tenants, query, planFilter, statusFilter]);

  const totals = useMemo(() => {
    const all = tenants ?? [];
    return {
      mrr: all.reduce((s, t) => s + t.mrr, 0),
      active: all.filter((t) => t.status === "active").length,
      trials: all.filter((t) => t.status === "trial").length,
      suspended: all.filter((t) => t.status === "suspended").length,
    };
  }, [tenants]);

  const planMutation = useMutation({
    mutationFn: ({ tenant, plan }: { tenant: Tenant; plan: TenantPlan }) =>
      adminService.updateTenant(tenant.id, { plan }),
    onSuccess: (_, { tenant, plan }) => {
      toast.success(t("toastPlanChanged", { venue: tenant.venueName, plan }));
      setPendingPlan(null);
      invalidate();
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ tenant, status }: { tenant: Tenant; status: TenantStatus }) =>
      adminService.updateTenant(tenant.id, { status }),
    onSuccess: (_, { tenant, status }) => {
      toast.success(t("toastStatusChanged", { venue: tenant.venueName, status }));
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (tenant: Tenant) => adminService.deleteTenant(tenant.id),
    onSuccess: (_, tenant) => {
      toast.info(t("toastDeleted", { venue: tenant.venueName }));
      invalidate();
    },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <Button asChild>
            <Link href="/admin/onboarding">
              <Rocket className="size-4" /> {t("provisionTenant")}
            </Link>
          </Button>
        }
      />

      {/* ---------- Portfolio summary ---------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label={t("metricMrr")} value={formatMoney(totals.mrr)} icon={CircleDollarSign} hint={t("metricMrrHint")} />
        <MetricCard label={t("metricActive")} value={String(totals.active)} icon={Building2} />
        <MetricCard label={t("metricTrials")} value={String(totals.trials)} icon={Play} hint={t("metricTrialsHint")} />
        <MetricCard label={t("metricSuspended")} value={String(totals.suspended)} icon={Ban} />
      </div>

      {/* ---------- Filters ---------- */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={planFilter} onValueChange={(v) => setPlanFilter(v as typeof planFilter)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder={t("filterPlanPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filterPlanAll")}</SelectItem>
            {PLANS.map((plan) => (
              <SelectItem key={plan} value={plan} className="capitalize">
                {plan}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder={t("filterStatusPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filterStatusAll")}</SelectItem>
            {STATUSES.map((status) => (
              <SelectItem key={status} value={status} className="capitalize">
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {tenants === undefined ? (
        <ListSkeleton rows={5} rowHeight="h-14" />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columnVenue")}</TableHead>
                <TableHead>{t("columnPlan")}</TableHead>
                <TableHead>{t("columnStatus")}</TableHead>
                <TableHead className="text-right">{t("columnTables")}</TableHead>
                <TableHead className="text-right">{t("columnMrr")}</TableHead>
                <TableHead className="text-right">{t("columnSince")}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell>
                    <Link href={adminTenantHref(tenant.id)} className="group block">
                      <p className="font-medium group-hover:text-primary group-hover:underline">
                        {tenant.venueName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {tenant.slug} · {tenant.city}
                      </p>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={tenant.plan}
                      onValueChange={(plan) =>
                        setPendingPlan({ tenant, plan: plan as TenantPlan })
                      }
                    >
                      <SelectTrigger className="h-8 w-32 capitalize">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PLANS.map((plan) => (
                          <SelectItem key={plan} value={plan} className="capitalize">
                            {plan}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={tenant.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{tenant.metrics.tableCount}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(tenant.mrr)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {formatDate(tenant.createdAt)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={t("actionsAriaLabel")}>
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {tenant.status === "suspended" ? (
                          <ConfirmDialog
                            trigger={
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <Play className="size-4" /> {t("reactivateAction")}
                              </DropdownMenuItem>
                            }
                            title={t("confirmReactivateTitle", { venue: tenant.venueName })}
                            description={t("confirmReactivateDesc")}
                            confirmLabel={t("actionReactivate")}
                            onConfirm={() => statusMutation.mutate({ tenant, status: "active" })}
                          />
                        ) : (
                          <ConfirmDialog
                            trigger={
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <Ban className="size-4" /> {t("suspendAction")}
                              </DropdownMenuItem>
                            }
                            title={t("confirmSuspendTitle", { venue: tenant.venueName })}
                            description={t("confirmSuspendDesc")}
                            confirmLabel={t("actionSuspendTenant")}
                            destructive
                            onConfirm={() => statusMutation.mutate({ tenant, status: "suspended" })}
                          />
                        )}
                        {tenant.status === "trial" && (
                          <ConfirmDialog
                            trigger={
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <Play className="size-4" /> {t("convertTrialAction")}
                              </DropdownMenuItem>
                            }
                            title={t("confirmActivateTitle", { venue: tenant.venueName })}
                            description={t("confirmActivateDesc", { plan: tenant.plan })}
                            confirmLabel={t("actionStartBilling")}
                            onConfirm={() => statusMutation.mutate({ tenant, status: "active" })}
                          />
                        )}
                        <ConfirmDialog
                          trigger={
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={(e) => e.preventDefault()}
                            >
                              <Trash2 className="size-4" /> {t("deleteAction")}
                            </DropdownMenuItem>
                          }
                          title={t("confirmDeleteTitle", { venue: tenant.venueName })}
                          description={t("confirmDeleteDesc")}
                          confirmLabel={t("actionDeletePermanently")}
                          destructive
                          onConfirm={() => deleteMutation.mutate(tenant)}
                        />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ---------- Plan change confirmation ---------- */}
      <Dialog open={pendingPlan !== null} onOpenChange={(open) => !open && setPendingPlan(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {t("planChangeTitle", { venue: pendingPlan?.tenant.venueName ?? "", plan: pendingPlan?.plan ?? "" })}
            </DialogTitle>
            <DialogDescription>
              {t("planChangeDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setPendingPlan(null)} disabled={planMutation.isPending}>
              {t("actionCancel")}
            </Button>
            <Button onClick={() => pendingPlan && planMutation.mutate(pendingPlan)} disabled={planMutation.isPending}>
              {planMutation.isPending ? t("actionApplying") : t("actionChangePlan")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
