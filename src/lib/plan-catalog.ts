/**
 * plan-catalog — the single source of truth for what each subscription tier
 * contains and costs. Pure module (like fees.ts): both builds may import it.
 * The demo admin service holds the *editable* runtime copy; the live build
 * reads PlanConfig rows from the platform DB (seeded from these defaults).
 */
import type { FeatureDef, FeatureKey, PlanConfig, TenantPlan } from "@/lib/types";

/** One entry per gateable nav module, in nav order. */
export const FEATURE_CATALOG: FeatureDef[] = [
  { key: "analytics", label: "Analytics", description: "Nightly dashboard, comparisons and trends" },
  { key: "reports", label: "Reports", description: "Report builder, snapshots and exports" },
  { key: "inventory", label: "Inventory", description: "Stock ledger, restock and depletion tracking" },
  { key: "floor-map", label: "Floor map", description: "Visual floor map with live table status" },
  { key: "happy-hour", label: "Happy hour", description: "Scheduled price windows" },
  { key: "reservations", label: "Reservations", description: "Table reservations and arrivals" },
  { key: "events", label: "Events", description: "Event nights and programming" },
  { key: "promotions", label: "Promotions", description: "Campaigns and promo codes" },
  { key: "chat", label: "Team chat", description: "Floor coordination: chat, broadcasts, last call, shows" },
  { key: "multi-venue", label: "Multi-venue", description: "Manage several venues from one account" },
  { key: "door", label: "Door", description: "Live occupancy, admissions and the walk-in waitlist" },
  { key: "incidents", label: "Incidents", description: "Incident reports — security's record of the night" },
  { key: "guest-crm", label: "Guest CRM", description: "Persistent guest profiles, VIP recognition and merge tools" },
];

export const DEFAULT_PLAN_CONFIGS: PlanConfig[] = [
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: 0.99,
    tagline: "Essential QR ordering and venue operations for smaller teams.",
    highlight: false,
    tableLimit: 10,
    staffLimit: 5,
    // Door and incidents ship on every tier — safety isn't an upsell.
    features: ["inventory", "door", "incidents"],
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 1.99,
    tagline: "The complete operating system for every part of your night.",
    highlight: true,
    tableLimit: 40,
    staffLimit: 25,
    features: [
      "inventory",
      "analytics",
      "reports",
      "floor-map",
      "happy-hour",
      "reservations",
      "events",
      "promotions",
      "chat",
      "door",
      "incidents",
      "guest-crm",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthlyPrice: 2.99,
    tagline: "Every feature, unlimited scale, multi-venue operations.",
    highlight: false,
    tableLimit: null,
    staffLimit: null,
    features: [
      "inventory",
      "analytics",
      "reports",
      "floor-map",
      "happy-hour",
      "reservations",
      "events",
      "promotions",
      "chat",
      "multi-venue",
      "door",
      "incidents",
      "guest-crm",
    ],
  },
];

export function hasFeature(plan: TenantPlan, feature: FeatureKey, configs: PlanConfig[]): boolean {
  return configs.find((c) => c.id === plan)?.features.includes(feature) ?? false;
}

export function planLimits(plan: TenantPlan, configs: PlanConfig[]) {
  const config = configs.find((c) => c.id === plan);
  return { tableLimit: config?.tableLimit ?? null, staffLimit: config?.staffLimit ?? null };
}

/** MRR a tenant contributes — trials and suspensions don't bill. */
export function tenantMrr(plan: TenantPlan, status: string, configs: PlanConfig[]): number {
  if (status !== "active") return 0;
  return configs.find((c) => c.id === plan)?.monthlyPrice ?? 0;
}
