/**
 * automation-core.ts — live-track automation rule CRUD and execution logger.
 *
 * Phase 4 (AM-01 through AM-13). Each venue gets a set of default rules seeded
 * on first read. Executions are append-only; trigger logic lives in cron jobs.
 */
import type { getDb } from "../features/shared/db";
import type { PrismaClient } from "@prisma/client";
import type { AutomationRule as AutomationRuleType, AutomationExecution } from "@/lib/types";
import { defaultAutomationRules } from "./automation-defaults";

type ScopedDb = ReturnType<typeof getDb>;

/** Map a DB row to the API-facing AutomationRule shape. */
function toRule(row: Record<string, unknown>): AutomationRuleType {
  return {
    id: row.id as string,
    code: row.code as AutomationRuleType["code"],
    label: row.label as string,
    description: row.description as string,
    enabled: (row.enabled as boolean) ?? false,
    category: row.category as AutomationRuleType["category"],
    config: (row.config ?? {}) as Record<string, string | number | boolean>,
    lastTriggeredAt: row.lastTriggeredAt ? (row.lastTriggeredAt as Date).toISOString() : undefined,
    createdAt: (row.createdAt as Date).toISOString(),
    updatedAt: (row.updatedAt as Date).toISOString(),
  };
}

function toExecution(row: Record<string, unknown>): AutomationExecution {
  return {
    id: row.id as string,
    ruleId: row.ruleId as string,
    code: row.code as AutomationExecution["code"],
    triggeredAt: (row.triggeredAt as Date).toISOString(),
    result: row.result as string,
    actionApplied: (row.actionApplied as boolean) ?? false,
    affectedEntityIds: (row.affectedEntityIds ?? []) as string[],
    durationMs: (row.durationMs as number) ?? 0,
  };
}

/** Ensure the venue has all 13 default automation rules. Idempotent. Uses raw Prisma for the compound unique key. */
export async function ensureRules(
  rawPrisma: PrismaClient,
  venueId: string,
): Promise<AutomationRuleType[]> {
  const rules: AutomationRuleType[] = [];
  for (const def of defaultAutomationRules) {
    const row = await rawPrisma.automationRule.upsert({
      where: { venueId_code: { venueId, code: def.code } },
      create: { venueId, ...def },
      update: {},
    }) as unknown as Record<string, unknown>;
    rules.push(toRule(row));
  }
  return rules;
}

/** List all automation rules for a venue. Caller must ensure rules exist first. */
export async function listRules(db: ScopedDb): Promise<AutomationRuleType[]> {
  const rows = await db.automationRule.findMany({ orderBy: { category: "asc" } });
  if (rows.length === 0) return [];
  return rows.map((r) => toRule(r as unknown as Record<string, unknown>));
}

/** Toggle a rule on or off. */
export async function setRuleEnabled(
  db: ScopedDb,
  ruleId: string,
  enabled: boolean,
): Promise<AutomationRuleType> {
  const row = await db.automationRule.update({
    where: { id: ruleId },
    data: { enabled },
  });
  return toRule(row as unknown as Record<string, unknown>);
}

/** Update a rule's config. */
export async function updateRuleConfig(
  db: ScopedDb,
  ruleId: string,
  config: Record<string, string | number | boolean>,
): Promise<AutomationRuleType> {
  const row = await db.automationRule.update({
    where: { id: ruleId },
    data: { config: config as unknown as Record<string, unknown> },
  });
  return toRule(row as unknown as Record<string, unknown>);
}

/** Record an automation execution — append-only. Updates lastTriggeredAt on the parent rule. */
export async function recordExecution(
  db: ScopedDb,
  venueId: string,
  exec: Omit<AutomationExecution, "id">,
): Promise<AutomationExecution> {
  const row = await db.automationExecution.create({
    data: {
      venueId, // explicit — satisfies Prisma's type check
      ruleId: exec.ruleId,
      code: exec.code,
      triggeredAt: new Date(exec.triggeredAt),
      result: exec.result,
      actionApplied: exec.actionApplied,
      affectedEntityIds: exec.affectedEntityIds,
      durationMs: exec.durationMs,
    },
  }) as unknown as Record<string, unknown>;
  await db.automationRule.update({
    where: { id: exec.ruleId },
    data: { lastTriggeredAt: new Date(exec.triggeredAt) },
  });
  return toExecution(row);
}

/** List execution log entries for a venue, newest first. */
export async function listExecutions(
  db: ScopedDb,
  limit = 50,
): Promise<AutomationExecution[]> {
  const rows = await db.automationExecution.findMany({
    orderBy: { triggeredAt: "desc" },
    take: limit,
  });
  return rows.map((r) => toExecution(r as unknown as Record<string, unknown>));
}
