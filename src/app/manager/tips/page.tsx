"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Calculator, DollarSign, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/list-skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { tipsService } from "@/lib/services/tips-service";
import { timeService } from "@/lib/services/time-service";
import { staffService } from "@/lib/services/staff-service";
import { computeTipDistribution } from "@/lib/workforce";
import { formatMoney } from "@/lib/format";
import { canDo } from "@/lib/permissions";
import { permissionService } from "@/lib/services/permission-service";
import type { RolePermissions } from "@/lib/permissions";
import type { StaffMember, TipDistribution, TipPoolRule, TimeEntry } from "@/lib/types";

export default function ManagerTipsPage() {
  const [rule, setRule] = useState<TipPoolRule | null>(null);
  const [dist, setDist] = useState<TipDistribution | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [me, setMe] = useState<StaffMember | null>(null);
  const [permissions, setPermissions] = useState<RolePermissions | null>(null);

  const refresh = useCallback(async () => {
    const [r, d, s, e, perm, current] = await Promise.all([
      tipsService.getRule(),
      tipsService.getDistribution("2026-07-24"),
      staffService.listStaff(),
      timeService.listEntries(),
      permissionService.getRolePermissions("venue-1"),
      staffService.getCurrentStaff(),
    ]);
    setRule(r);
    setDist(d);
    setStaff(s);
    setEntries(e);
    setPermissions(perm);
    setMe(current);
    setReady(true);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const canClose = me && permissions ? canDo(permissions, me.role, "tips:close-distribution") : false;

  async function computeAndSave() {
    if (!rule) return;
    setSaving(true);
    try {
      const lines = computeTipDistribution(rule, 185000, staff, entries);
      const d: TipDistribution = {
        id: "td-fri",
        venueId: "venue-1",
        businessDate: "2026-07-24",
        ruleId: rule.id,
        poolCents: 185000,
        lines,
        computedAt: new Date().toISOString(),
        closedByStaffId: "",
      };
      await tipsService.saveDistribution(d);
      setDist(d);
      toast.success("Tip distribution computed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not compute tips");
    } finally {
      setSaving(false);
    }
  }

  async function closeDistribution() {
    if (!dist || !me) return;
    setSaving(true);
    try {
      const d = await tipsService.closeDistribution(dist.id, me.id);
      setDist(d);
      toast.success("Distribution closed — staff can now see their shares");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not close distribution");
    } finally {
      setSaving(false);
    }
  }

  if (!ready) return <ListSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tips"
        description="Distribute the night's tip pool by rule"
        actions={
          <Button onClick={computeAndSave} disabled={saving} size="sm" variant="outline">
            <Calculator className="size-4 mr-1" /> Recompute
          </Button>
        }
      />

      {!rule ? (
        <EmptyState icon={DollarSign} title="No tip pool rule" description="Configure a rule in Settings to compute tip distributions." />
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                {rule.name}
                <Badge variant="outline">{rule.basis}</Badge>
                {rule.houseRetentionPct > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {rule.houseRetentionPct}% house retention
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Shared among: {rule.includeRoles.join(", ")}
            </CardContent>
          </Card>

          {dist && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>
                    {dist.businessDate} — {formatMoney(dist.poolCents, "CAD")}
                  </span>
                  {dist.closedByStaffId ? (
                    <Badge><Lock className="size-3 mr-1" /> Closed</Badge>
                  ) : (
                    <ConfirmDialog
                      trigger={
                        <Button variant="default" size="sm" disabled={!canClose || saving}>
                          Close distribution
                        </Button>
                      }
                      title="Close the tip distribution?"
                      description="Staff will see their shares. This writes an audit entry and cannot be undone."
                      confirmLabel="Close"
                      onConfirm={closeDistribution}
                    />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {dist.lines.map((line) => {
                    const s = staff.find((st) => st.id === line.staffId);
                    return (
                      <div key={line.staffId} className="flex items-center justify-between rounded-md border px-3 py-2">
                        <div>
                          <p className="text-sm font-medium">{s?.name ?? line.staffId}</p>
                          <p className="text-xs text-muted-foreground">{s?.role}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold tabular-nums">{formatMoney(line.shareCents, "CAD")}</p>
                          <p className="text-xs text-muted-foreground">Basis: {Math.round(line.basisValue)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
