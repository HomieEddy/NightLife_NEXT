"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Calculator, DollarSign, Lock, Pencil, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import type { StaffMember, StaffRole, TipDistribution, TipPoolRule, TipPoolBasis, TimeEntry } from "@/lib/types";

const STAFF_ROLES: StaffRole[] = ["bartender", "runner", "host", "security", "promoter"];
const BASIS_OPTIONS = [{ value: "hours-weighted", label: "Hours weighted" }, { value: "equal", label: "Equal" }, { value: "role-percentage", label: "Role percentage" }];

export default function ManagerTipsPage() {
  const [rule, setRule] = useState<TipPoolRule | null>(null);
  const [distributions, setDistributions] = useState<TipDistribution[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [me, setMe] = useState<StaffMember | null>(null);
  const [permissions, setPermissions] = useState<RolePermissions | null>(null);

  // Rule edit dialog
  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState({ name: "", basis: "hours-weighted", includeRoles: [] as StaffRole[], houseRetentionPct: 0 });

  // Distribution form
  const [poolCents, setPoolCents] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));

  const refresh = useCallback(async () => {
    const [r, ds, s, e, perm, current] = await Promise.all([
      tipsService.getRule(), tipsService.listDistributions(), staffService.listStaff(), timeService.listEntries(),
      permissionService.getRolePermissions("venue-1"), staffService.getCurrentStaff(),
    ]);
    setRule(r); setDistributions(ds); setStaff(s); setEntries(e); setPermissions(perm); setMe(current); setReady(true);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const canClose = me && permissions ? canDo(permissions, me.role, "tips:close-distribution") : false;

  function openRuleEdit() {
    if (rule) {
      setRuleForm({ name: rule.name, basis: rule.basis, includeRoles: rule.includeRoles, houseRetentionPct: rule.houseRetentionPct });
    } else {
      setRuleForm({ name: "", basis: "hours-weighted", includeRoles: ["bartender", "runner"], houseRetentionPct: 0 });
    }
    setRuleOpen(true);
  }

  async function saveRule() {
    if (!ruleForm.name.trim()) { toast.error("Name is required"); return; }
    if (ruleForm.includeRoles.length === 0) { toast.error("Select at least one role"); return; }
    setSaving(true); try {
      const r: TipPoolRule = { id: rule?.id ?? "tip-rule-1", venueId: "venue-1", name: ruleForm.name.trim(), basis: ruleForm.basis as TipPoolBasis, includeRoles: ruleForm.includeRoles, houseRetentionPct: ruleForm.houseRetentionPct, active: true };
      await tipsService.saveRule(r); setRule(r); setRuleOpen(false);
      toast.success("Tip pool rule saved");
    } catch { toast.error("Could not save rule"); } finally { setSaving(false); }
  }

  async function computeAndSave() {
    if (!rule) return; const pool = parseInt(poolCents); if (isNaN(pool) || pool <= 0) { toast.error("Enter a valid pool amount"); return; }
    setSaving(true); try {
      const lines = computeTipDistribution(rule, pool, staff, entries);
      const d: TipDistribution = { id: `td-${selectedDate}`, venueId: "venue-1", businessDate: selectedDate, ruleId: rule.id, poolCents: pool, lines, computedAt: new Date().toISOString(), closedByStaffId: "" };
      await tipsService.saveDistribution(d);
      await refresh(); setPoolCents("");
      toast.success(`Distribution computed for ${selectedDate}`);
    } catch { toast.error("Could not compute tips"); } finally { setSaving(false); }
  }

  async function closeDistribution(d: TipDistribution) {
    if (!me) return; setSaving(true); try {
      await tipsService.closeDistribution(d.id, me.id); await refresh();
      toast.success("Distribution closed — staff can now see their shares");
    } catch { toast.error("Could not close"); } finally { setSaving(false); }
  }

  function toggleRole(role: StaffRole) {
    setRuleForm((prev) => ({ ...prev, includeRoles: prev.includeRoles.includes(role) ? prev.includeRoles.filter((r) => r !== role) : [...prev.includeRoles, role] }));
  }

  if (!ready) return <ListSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader title="Tips" description="Distribute the night's tip pool by rule"
        actions={<Button size="sm" variant="outline" onClick={openRuleEdit}><Pencil className="size-4 mr-1" /> Edit rule</Button>}
      />

      {!rule ? (
        <EmptyState icon={DollarSign} title="No tip pool rule" description="Configure a rule to start." action={<Button onClick={openRuleEdit}><Settings className="size-4 mr-1" /> Create rule</Button>} />
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">{rule.name}
                <Badge variant="outline">{BASIS_OPTIONS.find((b) => b.value === rule.basis)?.label ?? rule.basis}</Badge>
                {rule.houseRetentionPct > 0 && <Badge variant="destructive" className="text-xs">{rule.houseRetentionPct}% retention</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Shared among: {rule.includeRoles.join(", ")}</CardContent>
          </Card>

          {/* Compute new distribution */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Compute distribution</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label htmlFor="t-date">Business date</Label><Input id="t-date" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} /></div>
                <div><Label htmlFor="t-pool">Pool amount ($)</Label><Input id="t-pool" placeholder="1850.00" value={poolCents} onChange={(e) => setPoolCents(e.target.value)} /></div>
              </div>
              <Button onClick={computeAndSave} disabled={saving || !poolCents} className="w-full"><Calculator className="size-4 mr-1" /> Compute & save</Button>
            </CardContent>
          </Card>

          {/* Distributions list */}
          {distributions.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Distributions</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {distributions.map((d) => {
                  const closed = !!d.closedByStaffId;
                  return (
                    <div key={d.id} className="rounded-md border px-3 py-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{d.businessDate} — {formatMoney(d.poolCents, "CAD")}</p>
                        <div className="flex items-center gap-2">
                          {closed ? <Badge variant="outline"><Lock className="size-3 mr-1" /> Closed</Badge> : (
                            <ConfirmDialog trigger={<Button size="sm" disabled={!canClose || saving}>Close</Button>} title="Close distribution?" description="Staff will see their shares. Writes an audit entry." confirmLabel="Close" onConfirm={() => closeDistribution(d)} />
                          )}
                        </div>
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-1">
                        {d.lines.slice(0, 6).map((l) => { const s = staff.find((st) => st.id === l.staffId); return <p key={l.staffId} className="text-xs text-muted-foreground">{s?.name ?? l.staffId}: <span className="tabular-nums font-medium text-foreground">{formatMoney(l.shareCents, "CAD")}</span></p>; })}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Rule edit dialog */}
      <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{rule ? "Edit rule" : "Create rule"}</DialogTitle><DialogDescription>Configure how tips are split among staff.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label htmlFor="r-name">Name</Label><Input id="r-name" value={ruleForm.name} onChange={(e) => setRuleForm((p) => ({ ...p, name: e.target.value }))} placeholder="Hours-weighted pool" /></div>
            <div><Label htmlFor="r-basis">Basis</Label><Select value={ruleForm.basis} onValueChange={(v) => setRuleForm((p) => ({ ...p, basis: v }))}><SelectTrigger id="r-basis"><SelectValue /></SelectTrigger><SelectContent>{BASIS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
            <div>
              <Label>Include roles</Label>
              <div className="mt-1 flex flex-wrap gap-1">{STAFF_ROLES.map((role) => <Badge key={role} variant={ruleForm.includeRoles.includes(role) ? "default" : "outline"} className="cursor-pointer text-[10px] capitalize" onClick={() => toggleRole(role)}>{role}</Badge>)}</div>
            </div>
            <div><Label htmlFor="r-house">House retention %</Label><Input id="r-house" type="number" min={0} max={100} value={ruleForm.houseRetentionPct} onChange={(e) => setRuleForm((p) => ({ ...p, houseRetentionPct: parseInt(e.target.value) || 0 }))} /><p className="text-[10px] text-muted-foreground mt-0.5">Tip retention is illegal in many jurisdictions. Consult local labour laws.</p></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleOpen(false)}>Cancel</Button>
            <Button onClick={saveRule} disabled={!ruleForm.name.trim() || ruleForm.includeRoles.length === 0 || saving}>{rule ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
