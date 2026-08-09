import type { getDb } from "@/features/shared/db";
import type { TipDistribution, TipDistributionLine, TipPoolRule } from "@/lib/types";

type ScopedDb = ReturnType<typeof getDb>;

// ── Pure functions (unit-testable) ──────────────────────────────────

/**
 * Distribute a tip pool according to a rule.
 *
 * INV-W2: Σ lines[i].shareCents === distributable pool (exactly) — the
 * distributable pool is poolCents minus the rule's houseRetentionPct
 * (the venue's cut, kept before staff splits).
 * Remainder cents from integer division are distributed largest-remainder
 * — same discipline as evenShares() in this codebase.
 */
export function distributeTips(
  poolCents: number,
  rule: TipPoolRule,
  staffBasis: { staffId: string; hoursWorked: number; weight: number; role: string }[],
): TipDistributionLine[] {
  const included = staffBasis.filter((s) => rule.includeRoles.includes(s.role as never));
  if (included.length === 0) return [];

  // House retention: the venue keeps this % of the pool before distribution.
  const retention = Math.max(0, Math.min(100, rule.houseRetentionPct ?? 0));
  const distributable = Math.round((poolCents * (100 - retention)) / 100);

  let weights: number[];
  switch (rule.basis) {
    case "equal":
      weights = included.map(() => 1);
      break;
    case "hours-weighted":
      weights = included.map((s) => s.hoursWorked * s.weight);
      break;
    case "role-percentage": {
      const rp = rule.rolePercentages ?? {};
      weights = included.map((s) => rp[s.role as keyof typeof rp] ?? 0);
      break;
    }
    default:
      weights = included.map(() => 1);
  }

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return included.map((s) => ({ staffId: s.staffId, basisValue: 0, shareCents: 0 }));

  // Largest-remainder distribution
  const lines = included.map((s, i) => {
    const raw = (distributable * weights[i]) / totalWeight;
    const share = Math.floor(raw);
    const remainder = raw - share;
    return {
      staffId: s.staffId,
      basisValue: rule.basis === "hours-weighted" ? s.hoursWorked : weights[i],
      shareCents: share,
      _remainder: remainder,
    };
  });

  const distributed = lines.reduce((sum, l) => sum + l.shareCents, 0);
  const remaining = distributable - distributed;

  // Distribute remaining cents one each to entries with largest remainders
  const byRemainder = [...lines]
    .map((l, i) => ({ i, r: l._remainder }))
    .sort((a, b) => b.r - a.r);

  for (let j = 0; j < remaining && j < byRemainder.length; j++) {
    lines[byRemainder[j].i].shareCents++;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return lines.map(({ _remainder, ...line }) => line);
}

// ── DB-backed functions ────────────────────────────────────────────

function dbRuleToRule(row: {
  id: string;
  venueId: string;
  name: string;
  basis: string;
  rolePercentages: unknown;
  includeRoles: string[];
  houseRetentionPct: number;
  active: boolean;
}): TipPoolRule {
  return {
    id: row.id,
    venueId: row.venueId,
    name: row.name,
    basis: row.basis as TipPoolRule["basis"],
    rolePercentages: (row.rolePercentages as TipPoolRule["rolePercentages"]) ?? undefined,
    includeRoles: row.includeRoles as TipPoolRule["includeRoles"],
    houseRetentionPct: row.houseRetentionPct,
    active: row.active,
  };
}

export async function getTipPoolRule(
  db: ScopedDb,
): Promise<TipPoolRule | null> {
  const row = await db.tipPoolRule.findFirst({ where: { active: true } });
  return row ? dbRuleToRule(row) : null;
}

export async function saveTipPoolRule(
  db: ScopedDb,
  rule: TipPoolRule,
): Promise<TipPoolRule> {
  const row = await db.tipPoolRule.upsert({
    where: { id: rule.id },
    create: {
      id: rule.id,
      venueId: rule.venueId,
      name: rule.name,
      basis: rule.basis,
      rolePercentages: (rule.rolePercentages as object) ?? undefined,
      includeRoles: rule.includeRoles,
      houseRetentionPct: rule.houseRetentionPct,
      active: rule.active,
    },
    update: {
      name: rule.name,
      basis: rule.basis,
      rolePercentages: (rule.rolePercentages as object) ?? undefined,
      includeRoles: rule.includeRoles,
      houseRetentionPct: rule.houseRetentionPct,
      active: rule.active,
    },
  });
  return dbRuleToRule(row);
}

function dbDistToDist(row: {
  id: string;
  venueId: string;
  businessDate: string;
  ruleId: string;
  poolCents: number;
  lines: unknown;
  computedAt: Date;
  closedByStaffId: string;
}): TipDistribution {
  return {
    id: row.id,
    venueId: row.venueId,
    businessDate: row.businessDate,
    ruleId: row.ruleId,
    poolCents: row.poolCents,
    lines: (Array.isArray(row.lines) ? row.lines : []) as TipDistributionLine[],
    computedAt: row.computedAt.toISOString(),
    closedByStaffId: row.closedByStaffId,
  };
}

export async function listTipDistributions(
  db: ScopedDb,
): Promise<TipDistribution[]> {
  const rows = await db.tipDistribution.findMany({ orderBy: { businessDate: "desc" } });
  return rows.map(dbDistToDist);
}

export async function getTipDistribution(
  db: ScopedDb,
  businessDate: string,
): Promise<TipDistribution | null> {
  const row = await db.tipDistribution.findFirst({ where: { businessDate } });
  return row ? dbDistToDist(row) : null;
}

export async function saveTipDistribution(
  db: ScopedDb,
  dist: TipDistribution,
): Promise<TipDistribution> {
  const row = await db.tipDistribution.upsert({
    where: { id: dist.id },
    create: {
      id: dist.id,
      venueId: dist.venueId,
      businessDate: dist.businessDate,
      ruleId: dist.ruleId,
      poolCents: dist.poolCents,
      lines: dist.lines,
      computedAt: new Date(dist.computedAt),
      closedByStaffId: dist.closedByStaffId,
    },
    update: {
      poolCents: dist.poolCents,
      lines: dist.lines,
      computedAt: new Date(dist.computedAt),
      closedByStaffId: dist.closedByStaffId,
    },
  });
  return dbDistToDist(row);
}

export async function closeTipDistribution(
  db: ScopedDb,
  distributionId: string,
  closerId: string,
): Promise<TipDistribution> {
  const row = await db.tipDistribution.update({
    where: { id: distributionId },
    data: { closedByStaffId: closerId, computedAt: new Date() },
  });
  return dbDistToDist(row);
}
