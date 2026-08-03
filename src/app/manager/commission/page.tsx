"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Calculator, Check, UserCheck } from "lucide-react";
import { useTranslations } from "next-intl";
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
import { usePermissions } from "@/features/platform/use-permissions";
import { commissionKeys } from "@/features/platform/query-keys";
import { staffKeys } from "@/features/workforce/query-keys";
import { useAuth } from "@/context/auth-context";
import type { CommissionStatement } from "@/lib/types";

function CommissionContent() {
  const t = useTranslations("manager.commission");
  const searchParams = useSearchParams();

  const BASIS_LABELS: Record<string, string> = {
    "net-revenue": t("netRevenue"),
    "table-minimum": t("tableMinimum"),
    "per-head": t("perHead"),
    "per-reservation": t("perReservation"),
  };
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

  const { data: me } = useQuery({
    queryKey: staffKeys.me(venueId),
    queryFn: () => staffService.getCurrentStaff(),
    enabled: !!venueId,
  });

  const { can } = usePermissions();
  const canApprove = can("commission:approve");
  const promoterStaff = staff.filter((s) => s.role === "promoter");

  const generateMutation = useMutation({
    mutationFn: async (staffId: string) => {
      if (!rules) throw new Error("Rules not loaded");
      const staffMember = staff.find((s) => s.id === staffId);
      if (!staffMember?.commissionRuleId) {
        toast.error(t("noRuleAssigned"));
        return;
      }
      const rule = rules.find((r) => r.id === staffMember.commissionRuleId);
      if (!rule) { toast.error(t("ruleNotFound")); return; }
      const periodStart = "2026-07-20";
      const periodEnd = "2026-07-26";
      const items = [
        { sourceId: "r-1", sourceType: "reservation" as const, basisCents: 12000, earnedCents: 1200 },
        { sourceId: "r-2", sourceType: "reservation" as const, basisCents: 8000, earnedCents: 800 },
      ];
      const stmt = buildCommissionStatement(rule, staffId, venueId, periodStart, periodEnd, items);
      await commissionService.saveStatement(stmt);
    },
    onSuccess: () => {
      toast.success(t("statementGenerated"));
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("couldNotGenerate")),
  });

  const approveMutation = useMutation({
    mutationFn: (stmt: CommissionStatement) => {
      if (!me) throw new Error("Not authenticated");
      return commissionService.approveStatement(stmt.id, me.id);
    },
    onSuccess: () => {
      toast.success(t("commissionApproved"));
      invalidate();
    },
    onError: () => toast.error(t("couldNotApprove")),
  });

  if (rules === undefined) return <ListSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} breadcrumbs={[{ label: t("team"), href: "/manager/staff" }, { label: t("title") }]} />
      {promoterStaff.length === 0 ? (
        <EmptyState icon={UserCheck} title={t("noPromoters")} description={t("noPromotersDesc")} />
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
                              <Badge variant="outline"><Check className="size-3 mr-1" /> {t("approved")}</Badge>
                            ) : (
                              <ConfirmDialog
                                trigger={<Button size="sm" disabled={!canApprove || approveMutation.isPending}>{t("approve")}</Button>}
                                title={t("approveTitle")}
                                description={t("approveDesc", { name: promoter.name, amount: formatMoney(stmt.totalCents, "CAD") })}
                                confirmLabel={t("approve")}
                                onConfirm={() => approveMutation.mutate(stmt)}
                              />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{t("attributedItems", { count: stmt.lines.length })} · {formatDate(stmt.periodStart)} – {formatDate(stmt.periodEnd)}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">{t("noStatements")}</p>
                    )}
                    <Button variant="outline" size="sm" className="w-full" onClick={() => generateMutation.mutate(promoter.id)} disabled={generateMutation.isPending}>
                      <Calculator className="size-3.5 mr-1" /> {t("generateStatement")}
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
