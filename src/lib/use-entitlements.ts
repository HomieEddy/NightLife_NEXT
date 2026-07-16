"use client";

import { useEffect, useState } from "react";
import type { FeatureKey, PlanConfig, TenantPlan } from "@/lib/types";
import { hasFeature, planLimits } from "@/lib/plan-catalog";
import { isDemoMode } from "@/lib/app-mode";
import { billingService } from "@/lib/services/billing-service";

export interface Entitlements {
  /** Null while loading (gates stay open — gating is UX, not security). */
  plan: TenantPlan | null;
  hasFeature: (key: FeatureKey) => boolean;
  tableLimit: number | null;
  staffLimit: number | null;
}

/**
 * The current venue's plan entitlements, from the platform's plan configs.
 * Demo mode only: reads the mock subscription. In the live build everything is
 * enabled — TODO(backend): plan 10 wires the tenant's real subscription and
 * moves enforcement server-side (403 + upgrade hint in scoped services).
 */
export function useEntitlements(): Entitlements {
  const [plan, setPlan] = useState<TenantPlan | null>(null);
  const [configs, setConfigs] = useState<PlanConfig[]>([]);

  useEffect(() => {
    if (!isDemoMode()) return;
    let cancelled = false;
    Promise.all([billingService.getSubscription(), billingService.listPlans()]).then(
      ([subscription, plans]) => {
        if (cancelled) return;
        setPlan(subscription.plan);
        setConfigs(plans);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isDemoMode() || plan === null) {
    return { plan: null, hasFeature: () => true, tableLimit: null, staffLimit: null };
  }
  const limits = planLimits(plan, configs);
  return {
    plan,
    hasFeature: (key) => hasFeature(plan, key, configs),
    ...limits,
  };
}
