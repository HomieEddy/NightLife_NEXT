"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Calculator, Check, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { commissionService } from "@/lib/services/commission-service";
import { staffService } from "@/lib/services/staff-service";
import { buildCommissionStatement } from "@/lib/workforce";
import { formatMoney } from "@/lib/format";
import { canDo } from "@/lib/permissions";
import { permissionService } from "@/lib/services/permission-service";
import type { RolePermissions } from "@/lib/permissions";
import type { CommissionRule, CommissionStatement, StaffMember } from "@/lib/types";

const BASIS_LABELS: Record<string, string> = {
  "net-revenue": "Net revenue",
  "table-minimum": "Table minimum",
  "per-head": "Per head",
  "per-reservation": "Per reservation",
};

function CommissionContent() {
  const searchParams = useSearchParams();
  const staffFilter = searchParams.get("staff") ?? "";
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [statements, setStatements] = useState<CommissionStatement[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [me, setMe] = useState<StaffMember | null>(null);
  const [permissions, setPermissions] = useState<RolePermissions | null>(null);

  const refresh = useCallback(async () => {
    const [rs, ss, s, perm, current] = await Promise.all([
      commissionService.listRules(staffFilter || undefined),
      commissionService.listStatements(staffFilter || undefined),
      staffService.listStaff(),
      permissionService.getRolePermissions("venue-1"),
      staffService.getCurrentStaff(),
    ]);
    setRules(rs); setStatements(ss); setStaff(s); setPermissions(perm); setMe(current); setReady(true);
  }, [staffFilter]);

  useEffect(() => { refresh(); }, [refresh]);

  const canApprove = me && permissions ? canDo(permissions, me.role, "commission:approve") : false;
  const promoterStaff = staff.filter((s) => s.role === "promoter");

  async function generateStatement(staffId: string) {
    setSaving(true);
    try {
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
      toast.success("Statement generated");
      await refresh();
    } catch { toast.error("Could not generate"); }
    finally { setSaving(false); }
  }

  async function approve(stmt: CommissionStatement) {
    if (!me) return;
    setSaving(true);
    try {
      await commissionService.approveStatement(stmt.id, me.id);
      toast.success("Commission statement approved");
      await refresh();
    } catch { toast.error("Could not approve"); }
    finally { setSaving(false); }
  }

  if (!ready) return <ListSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader title="Commission" description="Promoter commission rules and statements" />
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
                                trigger={<Button size="sm" disabled={!canApprove || saving}>Approve</Button>}
                                title="Approve commission statement?"
                                description={`${promoter.name} will see ${formatMoney(stmt.totalCents, "CAD")} in earnings. Writes an audit entry.`}
                                confirmLabel="Approve"
                                onConfirm={() => approve(stmt)}
                              />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{stmt.lines.length} attributed items · period {stmt.periodStart}–{stmt.periodEnd}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">No statements yet.</p>
                    )}
                    <Button variant="outline" size="sm" className="w-full" onClick={() => generateStatement(promoter.id)} disabled={saving}>
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
