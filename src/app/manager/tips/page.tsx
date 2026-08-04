"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Calculator, DollarSign, Lock, Pencil, Settings } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { useInfiniteSlice } from "@/hooks/use-infinite-slice";
import { InfiniteScrollSentinel } from "@/components/shared/infinite-scroll-sentinel";
import { tipsService } from "@/features/workforce/tips-service";
import { timeService } from "@/features/workforce/time-service";
import { staffService } from "@/features/workforce/staff-service";
import { computeTipDistribution } from "@/lib/workforce";
import { formatMoney } from "@/features/shared/format";
import { usePermissions } from "@/features/platform/use-permissions";
import { tipsKeys } from "@/features/platform/query-keys";
import { staffKeys, timeKeys } from "@/features/workforce/query-keys";
import { useAuth } from "@/context/auth-context";
import { zTipPoolRuleInput } from "@/lib/form-schemas";
import type { StaffRole, TipDistribution, TipPoolRule } from "@/lib/types";
import type { z } from "zod";

const STAFF_ROLES: StaffRole[] = ["bartender", "runner", "host", "security", "promoter"];

type FormValues = z.infer<typeof zTipPoolRuleInput>;
const EMPTY_VALUES: FormValues = { name: "", basis: "equal", includeRoles: ["bartender", "runner"], houseRetentionPct: 0 };

export default function ManagerTipsPage() {
  const t = useTranslations("manager.tips");
  const { user } = useAuth();

  const BASIS_OPTIONS = [{ value: "hours-weighted", label: t("hoursWeighted") }, { value: "equal", label: t("equal") }, { value: "role-percentage", label: t("rolePercentage") }];
  const venueId = user?.venueId ?? "";
  const queryClient = useQueryClient();
  const [ruleOpen, setRuleOpen] = useState(false);
  const [poolCents, setPoolCents] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(zTipPoolRuleInput),
    defaultValues: EMPTY_VALUES,
  });
  const includeRoles = watch("includeRoles");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: tipsKeys.all(venueId) });

  const { data: rule } = useQuery({
    queryKey: tipsKeys.rule(venueId),
    queryFn: () => tipsService.getRule(),
    enabled: !!venueId,
  });

  const { data: distributions } = useQuery({
    queryKey: tipsKeys.distributions(venueId),
    queryFn: () => tipsService.listDistributions(),
    enabled: !!venueId,
  });

  const { data: staff = [] } = useQuery({
    queryKey: staffKeys.list(venueId),
    queryFn: () => staffService.listStaff(),
    enabled: !!venueId,
  });

  const { data: entries = [] } = useQuery({
    queryKey: timeKeys.all(venueId),
    queryFn: () => timeService.listEntries(),
    enabled: !!venueId,
  });

  const { data: me } = useQuery({
    queryKey: staffKeys.me(venueId),
    queryFn: () => staffService.getCurrentStaff(),
    enabled: !!venueId,
  });

  const { can } = usePermissions();
  const canClose = can("tips:close-distribution");

  const { sliced, hasMore, loadMore } = useInfiniteSlice(distributions ?? [], 10);

  const saveRuleMutation = useMutation({
    mutationFn: (data: FormValues) => {
      const r: TipPoolRule = {
        id: rule?.id ?? "tip-rule-1",
        venueId: venueId,
        name: data.name.trim(),
        basis: data.basis as TipPoolRule["basis"],
        includeRoles: data.includeRoles as StaffRole[],
        houseRetentionPct: data.houseRetentionPct,
        active: true,
      };
      return tipsService.saveRule(r);
    },
    onSuccess: () => {
      setRuleOpen(false);
      toast.success(t("ruleSaved"));
      invalidate();
    },
    onError: () => toast.error(t("couldNotSaveRule")),
  });

  const computeMutation = useMutation({
    mutationFn: async () => {
      if (!rule) throw new Error("No rule configured");
      const pool = parseInt(poolCents);
      if (isNaN(pool) || pool <= 0) throw new Error("Enter a valid pool amount");
      const lines = computeTipDistribution(rule, pool, staff, entries);
      const d: TipDistribution = {
        id: `td-${selectedDate}`,
        venueId: venueId,
        businessDate: selectedDate,
        ruleId: rule.id,
        poolCents: pool,
        lines,
        computedAt: new Date().toISOString(),
        closedByStaffId: "",
      };
      await tipsService.saveDistribution(d);
      return selectedDate;
    },
    onSuccess: (date) => {
      setPoolCents("");
      toast.success(t("distributionComputed", { date }));
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : t("couldNotCompute")),
  });

  const closeMutation = useMutation({
    mutationFn: (d: TipDistribution) => {
      if (!me) throw new Error("Not authenticated");
      return tipsService.closeDistribution(d.id, me.id);
    },
    onSuccess: () => {
      toast.success(t("distributionClosed"));
      invalidate();
    },
    onError: () => toast.error(t("couldNotClose")),
  });

  function openRuleEdit() {
    if (rule) {
      reset({ name: rule.name, basis: rule.basis as FormValues["basis"], includeRoles: rule.includeRoles, houseRetentionPct: rule.houseRetentionPct });
    } else {
      reset(EMPTY_VALUES);
    }
    setRuleOpen(true);
  }

  const onSaveRule = handleSubmit((data) => saveRuleMutation.mutate(data));

  function toggleRole(role: StaffRole) {
    setValue("includeRoles",
      includeRoles.includes(role)
        ? includeRoles.filter((r) => r !== role)
        : [...includeRoles, role],
    );
  }

  if (distributions === undefined) return <ListSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")}
        breadcrumbs={[{ label: t("team"), href: "/manager/staff" }, { label: t("title") }]}
        actions={<Button size="sm" variant="outline" onClick={openRuleEdit}><Pencil className="size-4 mr-1" /> {t("editRule")}</Button>}
      />

      {!rule ? (
        <EmptyState icon={DollarSign} title={t("noRule")} description={t("noRuleDesc")} action={<Button onClick={openRuleEdit}><Settings className="size-4 mr-1" /> {t("createRule")}</Button>} />
      ) : (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">{rule.name}
                <Badge variant="outline">{BASIS_OPTIONS.find((b) => b.value === rule.basis)?.label ?? rule.basis}</Badge>
                {rule.houseRetentionPct > 0 && <Badge variant="destructive" className="text-xs">{rule.houseRetentionPct}% retention</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">{t("sharedAmong", { roles: rule.includeRoles.join(", ") })}</CardContent>
          </Card>

          {/* Compute new distribution */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">{t("computeDistribution")}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label htmlFor="t-date">{t("businessDate")}</Label><Input id="t-date" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} /></div>
                <div><Label htmlFor="t-pool">{t("poolAmount")}</Label><Input id="t-pool" placeholder="1850.00" value={poolCents} onChange={(e) => setPoolCents(e.target.value)} /></div>
              </div>
              <Button onClick={() => computeMutation.mutate()} disabled={computeMutation.isPending || !poolCents} className="w-full"><Calculator className="size-4 mr-1" /> {t("computeAndSave")}</Button>
            </CardContent>
          </Card>

          {/* Distributions list */}
          {distributions.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">{t("distributions")}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {sliced.map((d) => {
                  const closed = !!d.closedByStaffId;
                  return (
                    <div key={d.id} className="rounded-md border px-3 py-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{d.businessDate} — {formatMoney(d.poolCents, "CAD")}</p>
                        <div className="flex items-center gap-2">
                          {closed ? <Badge variant="outline"><Lock className="size-3 mr-1" /> {t("closed")}</Badge> : (
                            <ConfirmDialog trigger={<Button size="sm" disabled={!canClose || closeMutation.isPending}>{t("close")}</Button>} title={t("closeDistribution")} description={t("closeDistributionDesc")} confirmLabel={t("close")} onConfirm={() => closeMutation.mutate(d)} />
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
          <InfiniteScrollSentinel onLoadMore={loadMore} hasMore={hasMore} />
        </>
      )}

      {/* Rule edit dialog */}
      <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{rule ? t("editRuleTitle") : t("createRuleTitle")}</DialogTitle><DialogDescription>{t("ruleDescription")}</DialogDescription></DialogHeader>
          <form onSubmit={onSaveRule} className="space-y-3">
            <div><Label htmlFor="r-name">{t("name")}</Label><Input id="r-name" {...register("name")} placeholder={t("namePlaceholder")} />{errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}</div>
            <div><Label htmlFor="r-basis">{t("basis")}</Label><Select value={watch("basis")} onValueChange={(v) => setValue("basis", v as FormValues["basis"])}><SelectTrigger id="r-basis"><SelectValue /></SelectTrigger><SelectContent>{BASIS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
            <div>
              <Label>{t("includeRoles")}</Label>
              <div className="mt-1 flex flex-wrap gap-1">{STAFF_ROLES.map((role) => <Badge key={role} variant={includeRoles.includes(role) ? "default" : "outline"} className="cursor-pointer text-[10px] capitalize" onClick={() => toggleRole(role)}>{role}</Badge>)}</div>
              {errors.includeRoles && <p className="text-xs text-red-600">{errors.includeRoles.message}</p>}
            </div>
            <div><Label htmlFor="r-house">{t("houseRetention")}</Label><Input id="r-house" type="number" min={0} max={100} {...register("houseRetentionPct", { valueAsNumber: true })} /><p className="text-[10px] text-muted-foreground mt-0.5">{t("retentionWarning")}</p></div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setRuleOpen(false)}>{t("cancel")}</Button>
            <Button type="submit" disabled={saveRuleMutation.isPending}>{rule ? t("save") : t("create")}</Button>
          </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
