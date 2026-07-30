"use client";

// Plan 10 graduates this demo-only surface.

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity, ArrowLeft, Ban, Building2, CircleDollarSign, MapPin, Play, Receipt, Table2, Trash2, Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { RoleBadge } from "@/components/shared/role-badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { adminService } from "@/features/platform/admin-service";
import { adminKeys } from "@/features/platform/query-keys";
import { formatDate, formatMoney, timeAgo } from "@/features/shared/format";
import type { TenantPlan, TenantStatus } from "@/lib/types";

const PLAN_IDS: TenantPlan[] = ["starter", "pro", "enterprise"];

export default function AdminTenantDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pendingPlan, setPendingPlan] = useState<TenantPlan | null>(null);

  const { data: tenant } = useQuery({
    queryKey: adminKeys.tenant(params.id),
    queryFn: () => adminService.getTenant(params.id),
    enabled: !!params.id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: adminKeys.tenant(params.id) });
    queryClient.invalidateQueries({ queryKey: adminKeys.tenants });
  };

  const planMutation = useMutation({
    mutationFn: async () => {
      if (!tenant || !pendingPlan) throw new Error("Missing data");
      return adminService.updateTenant(tenant.id, { plan: pendingPlan });
    },
    onSuccess: () => {
      if (!tenant || !pendingPlan) return;
      toast.success(`${tenant.venueName} moved to ${pendingPlan}`);
      setPendingPlan(null);
      invalidate();
    },
  });

  const statusMutation = useMutation({
    mutationFn: (status: TenantStatus) => {
      if (!tenant) throw new Error("No tenant loaded");
      return adminService.updateTenant(tenant.id, { status });
    },
    onSuccess: (_, status) => {
      if (!tenant) return;
      toast.success(`${tenant.venueName} is now ${status}`);
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!tenant) throw new Error("No tenant loaded");
      return adminService.deleteTenant(tenant.id);
    },
    onSuccess: () => {
      if (!tenant) return;
      toast.info(`${tenant.venueName} deleted`);
      router.push("/admin/venues");
    },
  });

  if (tenant === undefined) {
    return (
      <div className="space-y-4">
        <PageHeader title="Tenant" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (tenant === null) {
    return (
      <EmptyState
        icon={Building2}
        title="Tenant not found"
        description="It may have been deleted."
        action={
          <Button variant="outline" asChild>
            <Link href="/admin/venues">
              <ArrowLeft className="size-4" /> Back to tenants
            </Link>
          </Button>
        }
      />
    );
  }

  const m = tenant.metrics;

  return (
    <div className="space-y-6">
      <PageHeader
        title={tenant.venueName}
        description={`${tenant.slug} · ${tenant.city} · since ${formatDate(tenant.createdAt)}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={tenant.status} />
            <Badge variant="outline" className="capitalize">{tenant.plan}</Badge>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/venues">
                <ArrowLeft className="size-4" /> All tenants
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard label="Orders · 30d" value={m.orderCount30d.toLocaleString()} icon={Receipt} />
        <MetricCard label="Sessions · 30d" value={m.sessionCount30d.toLocaleString()} icon={Activity} hint={`active ${timeAgo(m.lastActivityAt)}`} />
        <MetricCard label="Tables" value={String(m.tableCount)} icon={Table2} hint={`${m.zoneCount} zones`} />
        <MetricCard label="Staff" value={String(m.staffCount)} icon={Users} />
        <MetricCard label="MRR" value={formatMoney(tenant.mrr)} icon={CircleDollarSign} hint="paid to platform" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ---------- Provisioning snapshot ---------- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="size-4 text-primary" /> Provisioning settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Timezone</p>
                <p className="font-medium">{tenant.provisioning.timezone}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Currency</p>
                <p className="font-medium">{tenant.provisioning.currency}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Service fees</p>
              {tenant.provisioning.serviceFees.length === 0 ? (
                <p className="text-muted-foreground">None configured</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {tenant.provisioning.serviceFees.map((fee) => (
                    <li key={fee.name} className="flex justify-between rounded-md border px-2.5 py-1.5">
                      <span>{fee.name}</span>
                      <span className="tabular-nums">
                        {fee.type === "percentage" ? `${fee.value}%` : formatMoney(fee.value)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Menu categories</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {tenant.provisioning.menuCategories.map((cat) => (
                  <Badge key={cat} variant="secondary">{cat}</Badge>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Snapshot from provisioning — the venue manages its own live settings.
            </p>
          </CardContent>
        </Card>

        {/* ---------- Plan & status controls ---------- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan & status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Plan</p>
                <p className="text-xs text-muted-foreground">Billing follows the plan's configured price.</p>
              </div>
              <Select
                value={tenant.plan}
                onValueChange={(plan) => setPendingPlan(plan as TenantPlan)}
              >
                <SelectTrigger className="h-8 w-32 capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_IDS.map((plan) => (
                    <SelectItem key={plan} value={plan} className="capitalize">
                      {plan}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {tenant.status === "suspended" ? (
              <ConfirmDialog
                trigger={
                  <Button variant="outline" className="w-full">
                    <Play className="size-4" /> Reactivate tenant
                  </Button>
                }
                title={`Reactivate ${tenant.venueName}?`}
                description="Billing resumes and their staff regain access immediately."
                confirmLabel="Reactivate"
                onConfirm={() => statusMutation.mutate("active")}
              />
            ) : (
              <ConfirmDialog
                trigger={
                  <Button variant="outline" className="w-full">
                    <Ban className="size-4" /> Suspend tenant
                  </Button>
                }
                title={`Suspend ${tenant.venueName}?`}
                description="All venue panels are locked and billing pauses until reactivated."
                confirmLabel="Suspend tenant"
                destructive
                onConfirm={() => statusMutation.mutate("suspended")}
              />
            )}
            {tenant.status === "trial" && (
              <ConfirmDialog
                trigger={
                  <Button variant="outline" className="w-full">
                    <Play className="size-4" /> Convert trial to paid
                  </Button>
                }
                title={`Activate ${tenant.venueName}?`}
                description={`Ends the trial and starts billing on the ${tenant.plan} plan.`}
                confirmLabel="Start billing"
                onConfirm={() => statusMutation.mutate("active")}
              />
            )}
            <ConfirmDialog
              trigger={
                <Button variant="outline" className="w-full text-red-600 hover:text-red-600 dark:text-red-400">
                  <Trash2 className="size-4" /> Delete tenant
                </Button>
              }
              title={`Delete ${tenant.venueName}?`}
              description="Removes the tenant and all venue data. This cannot be undone."
              confirmLabel="Delete permanently"
              destructive
              onConfirm={() => deleteMutation.mutate()}
            />
          </CardContent>
        </Card>
      </div>

      {/* ---------- Staff roster ---------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4 text-primary" /> Staff ({tenant.staff.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tenant.staff.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No staff yet"
              description="The invited manager appears here after provisioning."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Email</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenant.staff.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.name}</TableCell>
                      <TableCell><RoleBadge role={member.role} /></TableCell>
                      <TableCell className="text-muted-foreground">{member.email}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------- Plan change confirmation ---------- */}
      <Dialog open={pendingPlan !== null} onOpenChange={(open) => !open && setPendingPlan(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Move {tenant.venueName} to {pendingPlan}?
            </DialogTitle>
            <DialogDescription>
              The plan changes at the next billing cycle; feature limits apply immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setPendingPlan(null)} disabled={planMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={() => planMutation.mutate()} disabled={planMutation.isPending}>
              {planMutation.isPending ? "Applying…" : "Change plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
