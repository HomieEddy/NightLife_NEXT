"use client";

// Plan 10 graduates this demo-only surface.

import { Suspense, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Rocket } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/shared/page-header";
import { adminService } from "@/features/platform/admin-service";
import { adminKeys } from "@/features/platform/query-keys";
import { formatMoney } from "@/features/shared/format";
import { cn } from "@/features/shared/utils";
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

  const [venueName, setVenueName] = useState("");
  const [city, setCity] = useState("");
  const [plan, setPlan] = useState<TenantPlan>("pro");
  const [startOnTrial, setStartOnTrial] = useState(true);
  const [managerName, setManagerName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");

  const t = useTranslations("admin.onboarding");

  const { data: plans = [] } = useQuery({
    queryKey: adminKeys.plans,
    queryFn: () => adminService.getPlanConfigs(),
  });

  const { data: lead, isFetched: leadReady } = useQuery({
    queryKey: adminKeys.lead(leadId!),
    queryFn: () => adminService.getLead(leadId!),
    enabled: !!leadId,
  });

  useEffect(() => {
    if (lead) {
      setVenueName(lead.venueName);
      setCity(lead.city);
      setManagerName(lead.contactName);
      setManagerEmail(lead.email);
    }
  }, [lead]);

  const prefilling = leadId !== null && !leadReady;

  const provisionMutation = useMutation({
    mutationFn: async () => {
      return adminService.onboardTenant({
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
    },
    onSuccess: (tenant) => {
      toast.success(
        startOnTrial
          ? t("provisionedToastTrial", { venue: tenant.venueName, email: managerEmail.trim() })
          : t("provisionedToast", { venue: tenant.venueName, email: managerEmail.trim() }),
      );
      router.push("/admin/venues");
    },
  });

  const slug = venueName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const valid =
    venueName.trim().length > 0 &&
    city.trim().length > 0 &&
    managerName.trim().length > 0 &&
    /\S+@\S+\.\S+/.test(managerEmail);

  if (prefilling) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("title")} description={t("loadingDescription")} />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        title={t("title")}
        description={
          leadId
            ? t("descriptionWithLead")
            : t("descriptionDefault")
        }
      />

      <Card>
        <CardContent className="space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="prov-name">{t("venueNameLabel")}</Label>
              <Input
                id="prov-name"
                placeholder={t("venueNamePlaceholder")}
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
              />
              {slug && (
                <p className="text-xs text-muted-foreground">
                  {t("urlPrefix")} <span className="font-mono">{slug}.nightlifenext.app</span>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prov-city">{t("cityLabel")}</Label>
              <Input
                id="prov-city"
                placeholder={t("cityPlaceholder")}
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("planLabel")}</Label>
            <div className="grid gap-3 sm:grid-cols-3">
              {plans.map((p) => (
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
                    <span className="text-xs font-normal text-muted-foreground">{t("perMonth")}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.tableLimit === null ? t("unlimitedTables") : t("upToTables", { limit: p.tableLimit })}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">{t("trialLabel")}</p>
              <p className="text-xs text-muted-foreground">
                {t("trialDescription")}
              </p>
            </div>
            <Switch checked={startOnTrial} onCheckedChange={setStartOnTrial} />
          </div>

          <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="prov-mgr-name">{t("managerNameLabel")}</Label>
              <Input
                id="prov-mgr-name"
                placeholder={t("managerNamePlaceholder")}
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prov-mgr-email">{t("managerEmailLabel")}</Label>
              <Input
                id="prov-mgr-email"
                type="email"
                placeholder={t("managerEmailPlaceholder")}
                value={managerEmail}
                onChange={(e) => setManagerEmail(e.target.value)}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {t("footerNote")}
          </p>

          <Button
            onClick={() => provisionMutation.mutate()}
            disabled={!valid || provisionMutation.isPending}
            className="w-full glow-primary"
          >
            {provisionMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
            {provisionMutation.isPending
              ? t("provisioning")
              : t("provisionButton", { name: venueName.trim() || t("provisionFallback") })}
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
