import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { getDb, type SessionContext } from "@/features/shared/db";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";
import {
  ensureRules,
  listRules,
  setRuleEnabled,
  updateRuleConfig,
  recordExecution,
  listExecutions,
} from "@/features/automation/core";
import { defaultAutomationRules } from "@/features/automation/defaults";
import { expectTenantIsolation } from "@/features/shared/test-helpers";

async function makeVenue(rawClient: PrismaClient, name: string, slug: string) {
  const org = await rawClient.organization.create({ data: { id: `org-${slug}`, name, slug } });
  await rawClient.venue.create({
    data: {
      id: org.id,
      address: "1 Test St",
      city: "Testville",
      timezone: "UTC",
      currency: "USD",
      openingHours: [],
      serviceFees: [],
      floorMap: { width: 16, height: 9 },
      autoApproveGuests: false,
      logoInitials: "TT",
      slaThresholds: { orderWarnMinutes: 6, orderCriticalMinutes: 12, helpWarnMinutes: 4, helpCriticalMinutes: 8 },
      lastCallAutoFlagTables: true,
    },
  });
  return org.id;
}

describe("automation integration (Phase 4)", () => {
  let testDb: TestDb;
  let rawClient: PrismaClient;
  let venueA: string;
  let venueB: string;
  let sessionA: SessionContext;

  beforeAll(async () => {
    testDb = await createTestDb();
    rawClient = testDb.rawClient;
    venueA = await makeVenue(rawClient, "Auto A", "auto-a-int");
    venueB = await makeVenue(rawClient, "Auto B", "auto-b-int");
    sessionA = { venueId: venueA };
  }, 60_000);

  afterAll(async () => {
    await testDb?.teardown();
  });

  afterEach(() => { vi.useRealTimers(); });

  // ── Rule seeding ────────────────────────────────────────────────────

  it("ensureRules seeds all 13 default rules, idempotent", async () => {
    const first = await ensureRules(rawClient, venueA);
    expect(first).toHaveLength(13);

    const codes = new Set(first.map((r) => r.code));
    for (const def of defaultAutomationRules) {
      expect(codes.has(def.code)).toBe(true);
    }

    // Idempotent — second call doesn't create duplicates
    const second = await ensureRules(rawClient, venueA);
    expect(second).toHaveLength(13);

    const db = getDb(sessionA);
    const count = await rawClient.automationRule.count({ where: { venueId: venueA } });
    expect(count).toBe(13);
  });

  // ── List rules ──────────────────────────────────────────────────────

  it("listRules returns all rules ordered by category", async () => {
    await ensureRules(rawClient, venueA);
    const db = getDb(sessionA);
    const rules = await listRules(db);
    expect(rules.length).toBeGreaterThan(0);

    // Verify sorting — categories should be grouped
    const categories = rules.map((r) => r.category);
    const sorted = [...categories].sort();
    expect(categories).toEqual(sorted);
  });

  // ── Toggle rule ─────────────────────────────────────────────────────

  it("setRuleEnabled toggles a rule on and off", async () => {
    await ensureRules(rawClient, venueA);
    const db = getDb(sessionA);
    const rules = await listRules(db);
    const first = rules[0];
    const wasEnabled = first.enabled;

    // Enable (or disable — toggle)
    const updated = await setRuleEnabled(db, first.id, !wasEnabled);
    expect(updated.enabled).toBe(!wasEnabled);

    // Verify persisted
    const dbRule = await rawClient.automationRule.findUnique({ where: { id: first.id, venueId: venueA } });
    expect(dbRule!.enabled).toBe(!wasEnabled);

    // Toggle back
    await setRuleEnabled(db, first.id, wasEnabled);
  });

  // ── Update config ───────────────────────────────────────────────────

  it("updateRuleConfig merges config values", async () => {
    await ensureRules(rawClient, venueA);
    const db = getDb(sessionA);
    const rules = await listRules(db);
    const first = rules[0];

    const updated = await updateRuleConfig(db, first.id, { graceMinutes: 45, notifyManager: false });
    expect(updated.config).toMatchObject({ graceMinutes: 45, notifyManager: false });

    const dbRule = await rawClient.automationRule.findUnique({ where: { id: first.id, venueId: venueA } });
    const config = dbRule!.config as Record<string, unknown>;
    expect(config.graceMinutes).toBe(45);
  });

  // ── Record execution ────────────────────────────────────────────────

  it("recordExecution creates a log entry and updates lastTriggeredAt", async () => {
    await ensureRules(rawClient, venueA);
    const db = getDb(sessionA);
    const rules = await listRules(db);
    const first = rules[0];

    const exec = await recordExecution(db, venueA, {
      ruleId: first.id,
      code: first.code,
      triggeredAt: new Date().toISOString(),
      result: "Test execution — auto-released 2 overdue reservations.",
      actionApplied: true,
      affectedEntityIds: ["res-01", "res-02"],
      durationMs: 45,
    });

    expect(exec.id).toMatch(/^[a-z0-9]+$/);
    expect(exec.ruleId).toBe(first.id);
    expect(exec.code).toBe(first.code);
    expect(exec.actionApplied).toBe(true);

    // Verify persisted in DB
    const dbExec = await rawClient.automationExecution.findUnique({ where: { id: exec.id, venueId: venueA } });
    expect(dbExec).toBeTruthy();
    expect(dbExec!.result).toBe(exec.result);

    // lastTriggeredAt updated on parent rule
    const dbRule = await rawClient.automationRule.findUnique({ where: { id: first.id, venueId: venueA } });
    expect(dbRule!.lastTriggeredAt).toBeTruthy();
  });

  // ── List executions ─────────────────────────────────────────────────

  it("listExecutions returns entries newest first", async () => {
    await ensureRules(rawClient, venueA);
    const db = getDb(sessionA);
    const rules = await listRules(db);
    const first = rules[0];

    await recordExecution(db, venueA, {
      ruleId: first.id, code: first.code,
      triggeredAt: new Date("2026-07-14T22:00:00Z").toISOString(),
      result: "First execution.", actionApplied: true, affectedEntityIds: [], durationMs: 30,
    });
    await recordExecution(db, venueA, {
      ruleId: first.id, code: first.code,
      triggeredAt: new Date("2026-07-15T22:00:00Z").toISOString(),
      result: "Second execution.", actionApplied: false, affectedEntityIds: [], durationMs: 35,
    });

    const execs = await listExecutions(db);
    expect(execs.length).toBeGreaterThanOrEqual(2);

    // Newest first
    const timestamps = execs.map((e) => new Date(e.triggeredAt).getTime());
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i - 1]).toBeGreaterThanOrEqual(timestamps[i]);
    }
  });

  // ── Tenant isolation ────────────────────────────────────────────────

  it("automation rules are tenant-isolated", async () => {
    await ensureRules(rawClient, venueA);

    // Verify counts are independent
    const rulesA = await rawClient.automationRule.count({ where: { venueId: venueA } });
    const rulesB = await rawClient.automationRule.count({ where: { venueId: venueB } });
    expect(rulesA).toBe(13);
    expect(rulesB).toBe(0); // Venue B was NOT seeded

    // Venue B cannot read Venue A's rules through scoped client
    await expectTenantIsolation(
      venueA,
      venueB,
      (db) => db.automationRule.findFirst(),
    );
  });
});
