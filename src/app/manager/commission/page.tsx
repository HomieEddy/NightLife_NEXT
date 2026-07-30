"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Calculator, Check, UserCheck } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { commissionService } from "@/features/workforce/commission-service";
import { staffService } from "@/features/workforce/staff-service";
import { buildCommissionStatement } from "@/lib/workforce";
import { formatDate, formatMoney } from "@/features/shared/format";
import { canDo } from "@/features/shared/permissions";
import { permissionService } from "@/features/platform/permission-service";
import { commissionKeys, permissionsKeys } from "@/features/platform/query-keys";
import { staffKeys } from "@/features/workforce/query-keys";
import { useAuth } from "@/context/auth-context";
import type { CommissionStatement } from "@/lib/types";

const BASIS_LABELS: Record<string, string> = {
  "net-revenue": "Net revenue",
  "table-minimum": "Table minimum",
  "per-head": "Per head",
  "per-reservation": "Per reservation",
};

function CommissionContent() {
  const searchParams = useSearchParams();
  const staffFilter = searchParams.get("staff") ?? "";
  const { user } = useAuth();
  const venueId = user?.venueId ?? "";
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: commissionKeys.all(venueId) });

  const { data: rules } = useQuery({
    queryKey: commissionKeys.rules(venueId, staffFilter || undefined),
    queryFn: () => commissionService.listRules(staffFilter || undefined),
    enabled: !!venueId,
  });

  const { data: statements = [] } = useQuery({
    queryKey: commissionKeys.statements(venueId, staffFilter || undefined),
    queryFn: () => commissionService.listStatements(staffFilter || undefined),
    enabled: !!venueId,
  });

  const { data: staff = [] } = useQuery({
    queryKey: staffKeys.list(venueId),
    queryFn: () => staffService.listStaff(),
    enabled: !!venueId,
  });

  const { data: permissions } = useQuery({
    queryKey: permissionsKeys.role(venueId),
    queryFn: () => permissionService.getRolePermissions("venue-1"),
    enabled: !!venueId,
  });

  const { data: me } = useQuery({
    queryKey: staffKeys.me(venueId),
    queryFn: () => staffService.getCurrentStaff(),
    enabled: !!venueId,
  });

  const canApprove = me && permissions ? canDo(permissions, me.role, "commission:approve") : false;
  const promoterStaff = staff.filter((s) => s.role === "promoter");

  const generateMutation = useMutation({
    mutationFn: async (staffId: string) => {
      if (!rules) throw new Error("Rules not loaded");
      const staffMember = staff.find((s) => s.id === staffId);
      if (!staffMember?.commissionRuleId) {
        toast.error("No commission rule assigned to this promoter.");
        return;
      }
      const rule = rules.find((r) => r.id === staffMember.commissionRuleId);
      if (!rule) { toast.error("Commission rule not found."); return; }
      const periodStart = "2026-07-20";
      const periodEnd = "2026-07-26";
      const items = [
        { sourceId: "r-1", sourceType: "reservation" as const, basisCents: 12000, earnedCents: 1200 },
        { sourceId: "r-2", sourceType: "reservation" as const, basisCents: 8000, earnedCents: 800 },
      ];
      const stmt = buildCommissionStatement(rule, staffId, "venue-1", periodStart, periodEnd, items);
      await commissionService.saveStatement(stmt);
    },
    onSuccess: () => {
      toast.success("Statement generated");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not generate"),
  });

  const approveMutation = useMutation({
    mutationFn: (stmt: CommissionStatement) => {
      if (!me) throw new Error("Not authenticated");
      return commissionService.approveStatement(stmt.id, me.id);
    },
    onSuccess: () => {
      toast.success("Commission statement approved");
      invalidate();
    },
    onError: () => toast.error("Could not approve"),
  });

  if (rules === undefined) return <ListSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader title="Commission" description="Promoter commission rules and statements" breadcrumbs={[{ label: "Team", href: "/manager/staff" }, { label: "Commission" }]} />
      {promoterStaff.length === 0 ? (
        <EmptyState icon={UserCheck} title="No promoters" description="Add a promoter to the team first." />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {promoterStaff.map((promoter) => {
              const rule = rules.find((r) => r.id === promoter.commissionRuleId);
              const promoStatements = statements.filter((s) => s.staffId === promoter.id);
              return (
                <Card key={promoter.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      {promoter.name}
                      {rule && <Badge variant="outline">{BASIS_LABELS[rule.basis] ?? rule.basis} · {rule.ratePct ? `${rule.ratePct}%` : `${formatMoney(rule.flatCents ?? 0, "CAD")}`}</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {promoStatements.length > 0 ? (
                      promoStatements.map((stmt) => (
                        <div key={stmt.id} className="rounded-md border px-3 py-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Total: {formatMoney(stmt.totalCents, "CAD")}</span>
                            {stmt.status === "approved" ? (
                              <Badge variant="outline"><Check className="size-3 mr-1" /> Approved</Badge>
                            ) : (
                              <ConfirmDialog
                                trigger={<Button size="sm" disabled={!canApprove || approveMutation.isPending}>Approve</Button>}
                                title="Approve commission statement?"
                                description={`${promoter.name} will see ${formatMoney(stmt.totalCents, "CAD")} in earnings. Writes an audit entry.`}
                                confirmLabel="Approve"
                                onConfirm={() => approveMutation.mutate(stmt)}
                              />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{stmt.lines.length} attributed items · {formatDate(stmt.periodStart)} – {formatDate(stmt.periodEnd)}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">No statements yet.</p>
                    )}
                    <Button variant="outline" size="sm" className="w-full" onClick={() => generateMutation.mutate(promoter.id)} disabled={generateMutation.isPending}>
                      <Calculator className="size-3.5 mr-1" /> Generate statement
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function ManagerCommissionPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <CommissionContent />
    </Suspense>
  );
}
