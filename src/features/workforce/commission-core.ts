import type { getDb } from "@/features/shared/db";
import type { CommissionLine, CommissionRule, CommissionStatement } from "@/lib/types";

type ScopedDb = ReturnType<typeof getDb>;

// ── Pure functions ─────────────────────────────────────────────────

/**
 * Compute commission earned for a single source line.
 * Returns 0 if the qualifier isn't met (e.g. no-show reservation).
 */
export function computeCommissionLine(
  rule: CommissionRule,
  basisCents: number,
  partySize?: number,
): number {
  // Check qualifier
  if (rule.qualifier) {
    if (rule.qualifier.minPartySize && (partySize ?? 0) < rule.qualifier.minPartySize) {
      return 0;
    }
  }

  if (rule.flatCents) return rule.flatCents;
  if (rule.ratePct) return Math.round((basisCents * rule.ratePct) / 100);
  return 0;
}

/**
 * Compute full commission statement lines from source data.
 * Each line: (sourceType, sourceId, basisCents) → earnedCents.
 */
export function computeCommissionLines(
  rule: CommissionRule,
  sources: { sourceType: CommissionLine["sourceType"]; sourceId: string; basisCents: number; partySize?: number }[],
): CommissionLine[] {
  return sources.map((src) => ({
    sourceType: src.sourceType,
    sourceId: src.sourceId,
    basisCents: src.basisCents,
    earnedCents: computeCommissionLine(rule, src.basisCents, src.partySize),
  }));
}

// ── DB-backed functions ────────────────────────────────────────────

function dbRuleToRule(row: {
  id: string;
  venueId: string;
  staffId: string | null;
  appliesToRole: string | null;
  basis: string;
  ratePct: number | null;
  flatCents: number | null;
  qualifier: unknown;
}): CommissionRule {
  return {
    id: row.id,
    venueId: row.venueId,
    staffId: row.staffId ?? undefined,
    appliesToRole: (row.appliesToRole as CommissionRule["appliesToRole"]) ?? undefined,
    basis: row.basis as CommissionRule["basis"],
    ratePct: row.ratePct ?? undefined,
    flatCents: row.flatCents ?? undefined,
    qualifier: row.qualifier as CommissionRule["qualifier"] ?? undefined,
  };
}

export async function listCommissionRules(
  db: ScopedDb,
  staffId?: string,
): Promise<CommissionRule[]> {
  const rows = await db.commissionRule.findMany({
    where: staffId ? { staffId } : undefined,
  });
  return rows.map(dbRuleToRule);
}

export async function saveCommissionRule(
  db: ScopedDb,
  rule: CommissionRule,
): Promise<CommissionRule> {
  const row = await db.commissionRule.upsert({
    where: { id: rule.id },
    create: {
      id: rule.id,
      venueId: rule.venueId,
      staffId: rule.staffId ?? null,
      appliesToRole: rule.appliesToRole ?? null,
      basis: rule.basis,
      ratePct: rule.ratePct ?? null,
      flatCents: rule.flatCents ?? null,
      qualifier: (rule.qualifier as object) ?? undefined,
    },
    update: {
      staffId: rule.staffId ?? null,
      appliesToRole: rule.appliesToRole ?? null,
      basis: rule.basis,
      ratePct: rule.ratePct ?? null,
      flatCents: rule.flatCents ?? null,
      qualifier: (rule.qualifier as object) ?? undefined,
    },
  });
  return dbRuleToRule(row);
}

function dbStmtToStmt(row: {
  id: string;
  venueId: string;
  staffId: string;
  periodStart: Date;
  periodEnd: Date;
  lines: unknown;
  totalCents: number;
  status: string;
  approvedByStaffId: string | null;
}): CommissionStatement {
  return {
    id: row.id,
    venueId: row.venueId,
    staffId: row.staffId,
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    lines: (Array.isArray(row.lines) ? row.lines : []) as CommissionLine[],
    totalCents: row.totalCents,
    status: row.status as CommissionStatement["status"],
    approvedByStaffId: row.approvedByStaffId ?? undefined,
  };
}

export async function listCommissionStatements(
  db: ScopedDb,
  staffId?: string,
): Promise<CommissionStatement[]> {
  const rows = await db.commissionStatement.findMany({
    where: staffId ? { staffId } : undefined,
    orderBy: { periodStart: "desc" },
  });
  return rows.map(dbStmtToStmt);
}

export async function saveCommissionStatement(
  db: ScopedDb,
  stmt: CommissionStatement,
): Promise<CommissionStatement> {
  const row = await db.commissionStatement.upsert({
    where: { id: stmt.id },
    create: {
      id: stmt.id,
      venueId: stmt.venueId,
      staffId: stmt.staffId,
      periodStart: new Date(stmt.periodStart),
      periodEnd: new Date(stmt.periodEnd),
      lines: stmt.lines,
      totalCents: stmt.totalCents,
      status: stmt.status,
    },
    update: {
      lines: stmt.lines,
      totalCents: stmt.totalCents,
      status: stmt.status,
    },
  });
  return dbStmtToStmt(row);
}

export async function approveCommissionStatement(
  db: ScopedDb,
  statementId: string,
  approverId: string,
): Promise<CommissionStatement> {
  // Verify in draft status
  const existing = await db.commissionStatement.findFirst({
    where: { id: statementId },
  });
  if (!existing) throw new Error("Statement not found.");
  if (existing.status !== "draft") throw new Error("Statement is not in draft status.");

  const row = await db.commissionStatement.update({
    where: { id: statementId },
    data: { status: "approved", approvedByStaffId: approverId },
  });
  return dbStmtToStmt(row);
}
