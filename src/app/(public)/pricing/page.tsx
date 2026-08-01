import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { isDemoMode } from "@/features/shared/app-mode";
import { DEFAULT_PLAN_CONFIGS, FEATURE_CATALOG } from "@/lib/plan-catalog";
import { formatMoney } from "@/features/shared/format";
import type { PlanConfig } from "@/lib/types";

export const metadata = { title: "Pricing" };

/**
 * Plans come from the PlanConfig table, which admins edit at runtime. Static
 * prerendering would freeze prices at build time and make the production build
 * require a reachable, migrated database.
 */
export const dynamic = "force-dynamic";

const TRIAL = {
  name: "Trial",
  price: "Free",
  cadence: "/3 days",
  tagline: "Explore every feature with a full three-day venue trial.",
  cta: "Start 3-day trial",
  features: [
    "3 days of full access",
    "Every NightLifeNext feature",
    "No credit card required",
    "Cancel anytime",
  ],
};

function limitRows(plan: PlanConfig): string[] {
  return [
    plan.tableLimit === null ? "Unlimited tables" : `Up to ${plan.tableLimit} tables`,
    plan.staffLimit === null ? "Unlimited staff" : `Up to ${plan.staffLimit} staff`,
  ];
}

async function getPlans(): Promise<PlanConfig[]> {
  if (isDemoMode()) return DEFAULT_PLAN_CONFIGS;
  const { getPlatformDb } = await import("@/features/shared/db");
  const { listPlanConfigs } = await import("@/features/platform/admin-core");
  return listPlanConfigs(getPlatformDb());
}

export default async function PricingPage() {
  if (isDemoMode()) notFound();

  const plans = await getPlans();

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:py-20">
      <div className="text-center">
        <Badge variant="secondary">Simple venue pricing</Badge>
        <h1 className="text-display mt-4 text-3xl sm:text-4xl">Pricing that scales with your night</h1>
        <p className="text-voice mx-auto mt-3 max-w-xl text-lg text-muted-foreground">
          Start with every feature for three days, then choose the operating toolkit your venue needs.
        </p>
      </div>

      <div className="mt-12 grid items-stretch gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="flex h-full flex-col">
          <CardHeader className="space-y-3 pb-4">
            <CardTitle>{TRIAL.name}</CardTitle>
            <p className="text-3xl font-bold tracking-tight">
              {TRIAL.price}
              <span className="ml-1 text-sm font-normal text-muted-foreground">{TRIAL.cadence}</span>
            </p>
            <p className="min-h-10 text-sm text-muted-foreground">{TRIAL.tagline}</p>
          </CardHeader>
          <CardContent className="flex-1">
            <ul className="space-y-2.5">
              {TRIAL.features.map((label) => (
                <li key={label} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  {label}
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter className="pt-6">
            <Button className="w-full" variant="outline" asChild>
              <Link href="/login">{TRIAL.cta}</Link>
            </Button>
          </CardFooter>
        </Card>

        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={plan.highlight ? "focal-halo relative flex h-full flex-col overflow-visible" : "flex h-full flex-col"}
          >
            {plan.highlight && (
              <Badge variant="foil" className="absolute -top-3 left-1/2 -translate-x-1/2">Best value</Badge>
            )}
            <CardHeader className="space-y-3 pb-4">
              <CardTitle>{plan.name}</CardTitle>
              <p className="text-3xl font-bold tracking-tight tabular-nums">
                {formatMoney(plan.monthlyPrice)}
                <span className="ml-1 text-sm font-normal text-muted-foreground">/mo</span>
              </p>
              <p className="min-h-10 text-sm text-muted-foreground">{plan.tagline}</p>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="space-y-2.5">
                {limitRows(plan).map((label) => (
                  <li key={label} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    {label}
                  </li>
                ))}
                {FEATURE_CATALOG.map((feature) => {
                  const included = plan.features.includes(feature.key);
                  return (
                    <li key={feature.key} className="flex items-start gap-2 text-sm">
                      {included ? (
                        <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <X className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
                      )}
                      <span className={included ? "" : "text-muted-foreground/60"}>{feature.label}</span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
            <CardFooter className="pt-6">
              <Button className="w-full" variant={plan.highlight ? "foil" : "outline"} asChild>
                <Link href="/login">Choose {plan.name}</Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <p className="mt-10 text-center text-sm text-muted-foreground">
        Per venue, per month. No per-order fees or hardware lock-in. Cancel anytime.
      </p>
    </div>
  );
}
