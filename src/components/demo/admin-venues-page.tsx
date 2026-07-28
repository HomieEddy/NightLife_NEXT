"use client";

// Plan 10 graduates this demo-only surface.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import { adminService } from "@/lib/services/admin-service";
import { adminTenantHref } from "@/features/shared/entity-links";
import { formatDate, formatMoney } from "@/features/shared/format";
import type { Tenant, TenantPlan, TenantStatus } from "@/lib/types";

const PLANS: TenantPlan[] = ["starter", "pro", "enterprise"];
const STATUSES: TenantStatus[] = ["active", "trial", "suspended"];

export default function AdminVenuesPage() {
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [query, setQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<"all" | TenantPlan>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | TenantStatus>("all");

  const refresh = useCallback(async () => {
    setTenants(await adminService.listTenants());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

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

  const [pendingPlan, setPendingPlan] = useState<{ tenant: Tenant; plan: TenantPlan } | null>(null);
  const [applyingPlan, setApplyingPlan] = useState(false);

  async function confirmPlanChange() {
    if (!pendingPlan) return;
    setApplyingPlan(true);
    await adminService.updateTenant(pendingPlan.tenant.id, { plan: pendingPlan.plan });
    toast.success(`${pendingPlan.tenant.venueName} moved to ${pendingPlan.plan}`);
    setApplyingPlan(false);
    setPendingPlan(null);
    await refresh();
  }

  async function setStatus(tenant: Tenant, status: TenantStatus) {
    await adminService.updateTenant(tenant.id, { status });
    toast.success(`${tenant.venueName} is now ${status}`);
    await refresh();
  }

  async function remove(tenant: Tenant) {
    await adminService.deleteTenant(tenant.id);
    toast.info(`${tenant.venueName} deleted`);
    await refresh();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tenants"
        description="Every venue running on NightLifeNext."
        actions={
          <Button asChild>
            <Link href="/admin/onboarding">
              <Rocket className="size-4" /> Provision tenant
            </Link>
          </Button>
        }
      />

      {/* ---------- Portfolio summary ---------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="MRR" value={formatMoney(totals.mrr)} icon={CircleDollarSign} hint="Active tenants" />
        <MetricCard label="Active" value={String(totals.active)} icon={Building2} />
        <MetricCard label="Trials" value={String(totals.trials)} icon={Play} hint="14-day trials" />
        <MetricCard label="Suspended" value={String(totals.suspended)} icon={Ban} />
      </div>

      {/* ---------- Filters ---------- */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search venue, slug, city…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={planFilter} onValueChange={(v) => setPlanFilter(v as typeof planFilter)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All plans</SelectItem>
            {PLANS.map((plan) => (
              <SelectItem key={plan} value={plan} className="capitalize">
                {plan}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((status) => (
              <SelectItem key={status} value={status} className="capitalize">
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {tenants === null ? (
        <ListSkeleton rows={5} rowHeight="h-14" />
      ) : visible.length === 0 ? (
        <EmptyState icon={Building2} title="No tenants match" />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Venue</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Tables</TableHead>
                <TableHead className="text-right">MRR</TableHead>
                <TableHead className="text-right">Since</TableHead>
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
                        <Button variant="ghost" size="icon" aria-label="Tenant actions">
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {tenant.status === "suspended" ? (
                          <ConfirmDialog
                            trigger={
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <Play className="size-4" /> Reactivate
                              </DropdownMenuItem>
                            }
                            title={`Reactivate ${tenant.venueName}?`}
                            description="Billing resumes and their staff regain access immediately."
                            confirmLabel="Reactivate"
                            onConfirm={() => setStatus(tenant, "active")}
                          />
                        ) : (
                          <ConfirmDialog
                            trigger={
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <Ban className="size-4" /> Suspend
                              </DropdownMenuItem>
                            }
                            title={`Suspend ${tenant.venueName}?`}
                            description="All venue panels are locked and billing pauses until reactivated."
                            confirmLabel="Suspend tenant"
                            destructive
                            onConfirm={() => setStatus(tenant, "suspended")}
                          />
                        )}
                        {tenant.status === "trial" && (
                          <ConfirmDialog
                            trigger={
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <Play className="size-4" /> Convert trial to paid
                              </DropdownMenuItem>
                            }
                            title={`Activate ${tenant.venueName}?`}
                            description={`Ends the trial and starts billing on the ${tenant.plan} plan.`}
                            confirmLabel="Start billing"
                            onConfirm={() => setStatus(tenant, "active")}
                          />
                        )}
                        <ConfirmDialog
                          trigger={
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={(e) => e.preventDefault()}
                            >
                              <Trash2 className="size-4" /> Delete tenant
                            </DropdownMenuItem>
                          }
                          title={`Delete ${tenant.venueName}?`}
                          description="Removes the tenant and all venue data. This cannot be undone."
                          confirmLabel="Delete permanently"
                          destructive
                          onConfirm={() => remove(tenant)}
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
              Move {pendingPlan?.tenant.venueName} to {pendingPlan?.plan}?
            </DialogTitle>
            <DialogDescription>
              The plan changes at the next billing cycle; feature limits apply immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setPendingPlan(null)} disabled={applyingPlan}>
              Cancel
            </Button>
            <Button onClick={confirmPlanChange} disabled={applyingPlan}>
              {applyingPlan ? "Applying…" : "Change plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
