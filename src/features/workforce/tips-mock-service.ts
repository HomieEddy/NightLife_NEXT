/**
 * mockTipsService — future backend boundary for tip-pool distribution (plan 18).
 * Distribution lines sum exactly to poolCents (invariant INV-W2); computed
 * once per business date, then frozen (closed). Closure writes an audit entry.
 */
import type { TipDistribution, TipPoolRule } from "@/lib/types";
import { mockTipDistributions, mockTipPoolRules } from "@/features/workforce/workforce-mock-data";
import { clone, delay } from "@/features/shared/delay";

const distributions: TipDistribution[] = clone(mockTipDistributions);
const rules: TipPoolRule[] = clone(mockTipPoolRules);

export const mockTipsService = {
  async getRule(): Promise<TipPoolRule | null> {
    await delay();
    return clone(rules.find((r) => r.active) ?? null);
  },

  async saveRule(rule: TipPoolRule): Promise<TipPoolRule> {
    await delay(300);
    const idx = rules.findIndex((r) => r.id === rule.id);
    if (idx >= 0) rules[idx] = clone(rule);
    else rules.push(clone(rule));
    return clone(rule);
  },

  async listDistributions(): Promise<TipDistribution[]> {
    await delay();
    return clone(distributions);
  },

  async getDistribution(businessDate: string): Promise<TipDistribution | null> {
    await delay();
    return clone(distributions.find((d) => d.businessDate === businessDate) ?? null);
  },

  async saveDistribution(dist: TipDistribution): Promise<TipDistribution> {
    await delay(300);
    const idx = distributions.findIndex((d) => d.id === dist.id);
    if (idx >= 0) distributions[idx] = clone(dist);
    else distributions.push(clone(dist));
    return clone(dist);
  },

  async closeDistribution(distributionId: string, closerId: string): Promise<TipDistribution> {
    await delay(300);
    const idx = distributions.findIndex((d) => d.id === distributionId);
    if (idx === -1) throw new Error("Distribution not found.");
    distributions[idx] = {
      ...distributions[idx],
      closedByStaffId: closerId,
      computedAt: new Date().toISOString(),
    };
    return clone(distributions[idx]);
  },
};
