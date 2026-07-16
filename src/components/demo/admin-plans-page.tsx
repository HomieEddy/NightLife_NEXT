"use client";

// Plan 10 graduates this demo-only surface.

import { useCallback, useEffect, useState } from "react";
import { Loader2, Save, Star } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { adminService } from "@/lib/services/admin-service";
import { FEATURE_CATALOG } from "@/lib/plan-catalog";
import { formatMoney } from "@/lib/format";
import type { FeatureKey, PlanConfig, TenantPlan } from "@/lib/types";

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<PlanConfig[] | null>(null);
  const [drafts, setDrafts] = useState<Record<TenantPlan, PlanConfig> | null>(null);
  const [saving, setSaving] = useState<TenantPlan | null>(null);

  const refresh = useCallback(async () => {
    const configs = await adminService.getPlanConfigs();
    setPlans(configs);
    setDrafts(Object.fromEntries(configs.map((c) => [c.id, structuredClone(c)])) as Record<TenantPlan, PlanConfig>);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function patchDraft(id: TenantPlan, patch: Partial<PlanConfig>) {
    setDrafts((prev) => (prev ? { ...prev, [id]: { ...prev[id], ...patch } } : prev));
  }

  function toggleFeature(id: TenantPlan, key: FeatureKey, on: boolean) {
    setDrafts((prev) => {
      if (!prev) return prev;
      const features = on
        ? [...prev[id].features, key]
        : prev[id].features.filter((f) => f !== key);
      return { ...prev, [id]: { ...prev[id], features } };
    });
  }

  async function save(id: TenantPlan) {
    if (!drafts) return;
    const draft = drafts[id];
    const price = draft.monthlyPrice;
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Price must be zero or positive.");
      return;
    }
    if ((draft.tableLimit !== null && draft.tableLimit < 1) || (draft.staffLimit !== null && draft.staffLimit < 1)) {
      toast.error("Limits must be at least 1, or unlimited.");
      return;
    }
    setSaving(id);
    await adminService.updatePlanConfig(id, {
      name: draft.name,
      monthlyPrice: Math.round(price * 100) / 100,
      tagline: draft.tagline,
      highlight: draft.highlight,
      tableLimit: draft.tableLimit,
      staffLimit: draft.staffLimit,
      features: draft.features,
    });
    setSaving(null);
    toast.success(`${draft.name} plan updated`);
    await refresh();
  }

  function isDirty(id: TenantPlan): boolean {
    if (!plans || !drafts) return false;
    const saved = plans.find((p) => p.id === id);
    return JSON.stringify(saved) !== JSON.stringify(drafts[id]);
  }

  if (plans === null || drafts === null) {
    return (
      <div className="space-y-4">
        <PageHeader title="Plan builder" />
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[32rem] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Plan builder"
        description="Assemble what each tier contains. Changes propagate to feature gates, subscription cards and pricing."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((saved) => {
          const draft = drafts[saved.id];
          return (
            <Card key={saved.id} className={draft.highlight ? "border-primary ring-1 ring-primary/40" : undefined}>
              <CardHeader className="space-y-0 pb-3">
                <CardTitle className="flex items-center justify-between text-base capitalize">
                  {saved.id}
                  {draft.highlight && (
                    <Badge variant="outline" className="border-primary/40 text-primary">
                      <Star className="size-3" /> Highlighted
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={`${saved.id}-name`}>Name</Label>
                    <Input
                      id={`${saved.id}-name`}
                      value={draft.name}
                      onChange={(e) => patchDraft(saved.id, { name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${saved.id}-price`}>Price / month</Label>
                    <Input
                      id={`${saved.id}-price`}
                      type="number"
                      min={0}
                      step={0.01}
                      value={Number.isFinite(draft.monthlyPrice) ? draft.monthlyPrice : ""}
                      onChange={(e) => patchDraft(saved.id, { monthlyPrice: e.target.valueAsNumber })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`${saved.id}-tagline`}>Tagline</Label>
                  <Input
                    id={`${saved.id}-tagline`}
                    value={draft.tagline}
                    onChange={(e) => patchDraft(saved.id, { tagline: e.target.value })}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Highlight on pricing</p>
                    <p className="text-xs text-muted-foreground">Shows the “best value” treatment.</p>
                  </div>
                  <Switch
                    checked={draft.highlight}
                    onCheckedChange={(highlight) => patchDraft(saved.id, { highlight })}
                    aria-label={`Highlight the ${draft.name} plan`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <LimitField
                    id={`${saved.id}-tables`}
                    label="Table limit"
                    value={draft.tableLimit}
                    onChange={(tableLimit) => patchDraft(saved.id, { tableLimit })}
                  />
                  <LimitField
                    id={`${saved.id}-staff`}
                    label="Staff limit"
                    value={draft.staffLimit}
                    onChange={(staffLimit) => patchDraft(saved.id, { staffLimit })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Features</Label>
                  <div className="space-y-1.5">
                    {FEATURE_CATALOG.map((feature) => (
                      <div
                        key={feature.key}
                        className="flex items-center justify-between gap-2.5 rounded-lg border p-2.5"
                      >
                        <div className="leading-tight">
                          <p className="text-sm font-medium">{feature.label}</p>
                          <p className="text-xs text-muted-foreground">{feature.description}</p>
                        </div>
                        <Switch
                          checked={draft.features.includes(feature.key)}
                          onCheckedChange={(on) => toggleFeature(saved.id, feature.key, on === true)}
                          aria-label={`${feature.label} on ${draft.name}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <ConfirmDialog
                  trigger={
                    <Button className="w-full" disabled={!isDirty(saved.id) || saving !== null}>
                      {saving === saved.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Save className="size-4" />
                      )}
                      {saving === saved.id ? "Saving…" : "Save plan"}
                    </Button>
                  }
                  title={`Update the ${draft.name} plan?`}
                  description={`Feature gates, subscription cards and pricing change immediately for every ${saved.id} tenant. New price: ${formatMoney(Math.round((draft.monthlyPrice || 0) * 100) / 100)}/mo.`}
                  confirmLabel="Update plan"
                  onConfirm={() => save(saved.id)}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function LimitField({
  id, label, value, onChange,
}: {
  id: string;
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={1}
        placeholder="Unlimited"
        value={value ?? ""}
        onChange={(e) => onChange(Number.isNaN(e.target.valueAsNumber) ? null : e.target.valueAsNumber)}
      />
      <p className="text-xs text-muted-foreground">Empty = unlimited</p>
    </div>
  );
}
