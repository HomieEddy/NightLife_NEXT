import { describe, it, expect } from "vitest";
import { hasFeature, planLimits, tenantMrr, DEFAULT_PLAN_CONFIGS, FEATURE_CATALOG } from "./plan-catalog";
import type { FeatureKey, PlanConfig } from "./types";

describe("hasFeature — entitlement matrix", () => {
  const configs = DEFAULT_PLAN_CONFIGS;

  it("starter has inventory only", () => {
    expect(hasFeature("starter", "inventory", configs)).toBe(true);
    expect(hasFeature("starter", "analytics", configs)).toBe(false);
    expect(hasFeature("starter", "chat", configs)).toBe(false);
    expect(hasFeature("starter", "multi-venue", configs)).toBe(false);
  });

  it("pro has all features except multi-venue", () => {
    const proFeatures: FeatureKey[] = [
      "inventory", "analytics", "reports", "floor-map",
      "happy-hour", "reservations", "events", "promotions", "chat",
    ];
    for (const f of proFeatures) {
      expect(hasFeature("pro", f, configs)).toBe(true);
    }
    expect(hasFeature("pro", "multi-venue", configs)).toBe(false);
  });

  it("enterprise has every feature in the catalog", () => {
    for (const f of FEATURE_CATALOG) {
      expect(hasFeature("enterprise", f.key, configs)).toBe(true);
    }
  });

  it("unknown plan returns false", () => {
    expect(hasFeature("nonexistent" as "starter", "analytics", configs)).toBe(false);
  });
});

describe("planLimits", () => {
  const configs = DEFAULT_PLAN_CONFIGS;

  it("starter has 10 tables and 5 staff", () => {
    expect(planLimits("starter", configs)).toEqual({ tableLimit: 10, staffLimit: 5 });
  });

  it("pro has 40 tables and 25 staff", () => {
    expect(planLimits("pro", configs)).toEqual({ tableLimit: 40, staffLimit: 25 });
  });

  it("enterprise has unlimited (null) limits", () => {
    expect(planLimits("enterprise", configs)).toEqual({ tableLimit: null, staffLimit: null });
  });
});

describe("tenantMrr", () => {
  const configs = DEFAULT_PLAN_CONFIGS;

  it("active tenant returns plan price", () => {
    expect(tenantMrr("starter", "active", configs)).toBe(0.99);
    expect(tenantMrr("pro", "active", configs)).toBe(1.99);
    expect(tenantMrr("enterprise", "active", configs)).toBe(2.99);
  });

  it("trial tenant returns 0", () => {
    expect(tenantMrr("pro", "trial", configs)).toBe(0);
  });

  it("suspended tenant returns 0", () => {
    expect(tenantMrr("pro", "suspended", configs)).toBe(0);
  });
});

describe("plan-config validation rules", () => {
  it("every plan config has a unique id", () => {
    const ids = DEFAULT_PLAN_CONFIGS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every feature in a plan config exists in the catalog", () => {
    const catalogKeys = new Set(FEATURE_CATALOG.map((f) => f.key));
    for (const config of DEFAULT_PLAN_CONFIGS) {
      for (const f of config.features) {
        expect(catalogKeys.has(f)).toBe(true);
      }
    }
  });

  it("prices are non-negative", () => {
    for (const config of DEFAULT_PLAN_CONFIGS) {
      expect(config.monthlyPrice).toBeGreaterThanOrEqual(0);
    }
  });

  it("hasFeature works with custom configs (admin edits plan)", () => {
    const custom: PlanConfig[] = [
      { ...DEFAULT_PLAN_CONFIGS[0], features: ["analytics", "inventory"] },
    ];
    expect(hasFeature("starter", "analytics", custom)).toBe(true);
  });
});
