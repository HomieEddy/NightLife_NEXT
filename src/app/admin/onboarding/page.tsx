"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Rocket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/shared/page-header";
import { adminService } from "@/lib/services/admin-service";
import { PLANS } from "@/lib/services/billing-service";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TenantPlan } from "@/lib/types";

/**
 * Admin-side provisioning: create the tenant, pick the plan, invite the
 * manager. The venue's actual setup (floor, menu, fees) happens in the
 * manager-side onboarding wizard on their first sign-in.
 */
function ProvisioningContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadId = searchParams.get("lead");

  const [prefilling, setPrefilling] = useState(leadId !== null);
  const [provisioning, setProvisioning] = useState(false);

  const [venueName, setVenueName] = useState("");
  const [city, setCity] = useState("");
  const [plan, setPlan] = useState<TenantPlan>("pro");
  const [startOnTrial, setStartOnTrial] = useState(true);
  const [managerName, setManagerName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");

  useEffect(() => {
    if (!leadId) return;
    adminService.getLead(leadId).then((lead) => {
      if (lead) {
        setVenueName(lead.venueName);
        setCity(lead.city);
        setManagerName(lead.contactName);
        setManagerEmail(lead.email);
      }
      setPrefilling(false);
    });
  }, [leadId]);

  const slug = venueName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const valid =
    venueName.trim().length > 0 &&
    city.trim().length > 0 &&
    managerName.trim().length > 0 &&
    /\S+@\S+\.\S+/.test(managerEmail);

  async function provision() {
    setProvisioning(true);
    const tenant = await adminService.onboardTenant({
      venueName: venueName.trim(),
      city: city.trim(),
      address: "",
      timezone: "Europe/Paris",
      currency: "EUR",
      plan,
      startOnTrial,
      zones: [],
      menuCategories: [],
      serviceFees: [],
      managerName: managerName.trim(),
      managerEmail: managerEmail.trim().toLowerCase(),
      leadId: leadId ?? undefined,
    });
    setProvisioning(false);
    toast.success(
      `${tenant.venueName} provisioned${startOnTrial ? " on a 14-day trial" : ""} — setup invite sent to ${managerEmail.trim()}`,
    );
    router.push("/admin/venues");
  }

  if (prefilling) {
    return (
      <div className="space-y-4">
        <PageHeader title="Provision a tenant" description="Loading lead details…" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        title="Provision a tenant"
        description={
          leadId
            ? "Details prefilled from the won lead."
            : "Creates the tenant and emails the manager their setup invite — they configure the venue themselves on first sign-in."
        }
      />

      <Card>
        <CardContent className="space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="prov-name">Venue name *</Label>
              <Input
                id="prov-name"
                placeholder="e.g. Neon Garden"
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
              />
              {slug && (
                <p className="text-xs text-muted-foreground">
                  URL: <span className="font-mono">{slug}.nightlifenext.app</span>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prov-city">City *</Label>
              <Input
                id="prov-city"
                placeholder="e.g. Berlin"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Plan</Label>
            <div className="grid gap-3 sm:grid-cols-3">
              {PLANS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlan(p.id)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    plan === p.id ? "border-primary bg-primary/10" : "hover:border-primary/40",
                  )}
                >
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-lg font-bold tabular-nums">
                    {formatMoney(p.monthlyPrice)}
                    <span className="text-xs font-normal text-muted-foreground">/mo</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.tableLimit === null ? "Unlimited tables" : `Up to ${p.tableLimit} tables`}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">Start on a 14-day trial</p>
              <p className="text-xs text-muted-foreground">
                No billing until the trial converts; activate any time from Tenants.
              </p>
            </div>
            <Switch checked={startOnTrial} onCheckedChange={setStartOnTrial} />
          </div>

          <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="prov-mgr-name">Manager name *</Label>
              <Input
                id="prov-mgr-name"
                placeholder="Who runs the venue?"
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prov-mgr-email">Manager email *</Label>
              <Input
                id="prov-mgr-email"
                type="email"
                placeholder="Gets the setup invite"
                value={managerEmail}
                onChange={(e) => setManagerEmail(e.target.value)}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            The manager configures zones, menu, fees and their profile in the guided onboarding on
            first sign-in.
          </p>

          <Button onClick={provision} disabled={!valid || provisioning} className="w-full glow-primary">
            {provisioning ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
            {provisioning ? "Provisioning…" : `Provision ${venueName.trim() || "tenant"}`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminOnboardingPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <ProvisioningContent />
    </Suspense>
  );
}
