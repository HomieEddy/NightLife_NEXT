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
 * Reads the subscription via billingService (mock in demo, real in live).
 * Server-side enforcement (403 + upgrade hint) backs this up in route handlers.
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
