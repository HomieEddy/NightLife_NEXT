/**
 * mockAutomationService — demo-mode automation engine.
 *
 * Phase 4 (AM-01 through AM-13). Every automation rule ships as a toggle in the manager UI.
 * In demo mode, "triggering" a rule adds a realistic-looking execution log entry.
 * TODO(backend): Coolify cron → /api/jobs/* → real handlers, idempotent, job_runs dedup.
 */
import type {
  AutomationRule,
  AutomationCode,
  AutomationExecution,
} from "@/lib/types";
import { clone, delay, uid } from "@/features/shared/delay";

// ---------- Seed rules — one per AM code ----------

const RULE_DEFS: Omit<AutomationRule, "id" | "venueId" | "enabled" | "lastTriggeredAt" | "createdAt" | "updatedAt">[] = [
  {
    code: "auto-release-reservations",
    label: "Auto-release overdue reservations",
    description: "Release reservations that haven't checked in after the configurable grace period.",
    category: "reservations",
    config: { graceMinutes: 30, notifyManager: true },
  },
  {
    code: "auto-generate-po",
    label: "Auto-generate purchase orders",
    description: "Generate a suggested purchase order whenever stock drops below par levels.",
    category: "inventory",
    config: { checkFrequencyMinutes: 60, autoSubmit: false },
  },
  {
    code: "auto-escalate-orders",
    label: "Auto-escalate overdue orders",
    description: "Escalate orders that breach their SLA deadline — warn, alert manager, then auto-unclaim.",
    category: "orders",
    config: { warnMinutes: 6, criticalMinutes: 12, autoUnclaim: true },
  },
  {
    code: "auto-detect-duplicates",
    label: "Auto-detect duplicate reservations",
    description: "Flag reservations that share the same phone or email on the same date.",
    category: "reservations",
    config: { matchFields: "phone,email", autoFlag: true },
  },
  {
    code: "auto-vip-tier-upgrade",
    label: "Auto-flag VIP tier upgrades",
    description: "Suggest a VIP tier upgrade when a guest's trailing-90-day spend exceeds the configurable threshold.",
    category: "vip",
    config: { spendThresholdCents: 500000, requireManagerApproval: true },
  },
  {
    code: "auto-event-pricing",
    label: "Auto-apply event pricing",
    description: "Automatically apply event-specific menu pricing and packages during the event window.",
    category: "events",
    config: { applyMinutesBefore: 30, revertMinutesAfter: 30 },
  },
  {
    code: "auto-close-event",
    label: "Auto-close event",
    description: "Automatically close an event at its configured end time.",
    category: "events",
    config: { closeAtEndTime: true, sendNightSummary: true },
  },
  {
    code: "auto-remove-86",
    label: "Auto-remove from 86 board",
    description: "Reinstate items from the 86 board when inventory is restocked via purchase order receipt.",
    category: "inventory",
    config: { checkOnStockIn: true, notifyBarManager: true },
  },
  {
    code: "auto-pour-cost",
    label: "Auto-calculate pour cost",
    description: "Calculate pour cost per drink from recipe BOM + current average cost, flagging pours above target.",
    category: "inventory",
    config: { targetPourCost: 0.22, flagAboveTarget: true },
  },
  {
    code: "auto-flag-variance",
    label: "Auto-flag unusual stocktake variance",
    description: "Flag stocktake lines with variance exceeding the configurable percentage threshold.",
    category: "inventory",
    config: { varianceThresholdPct: 0.05, requireInvestigationNote: true },
  },
  {
    code: "auto-notify-vip-arrival",
    label: "Auto-notify VIP host on arrival",
    description: "Notify the assigned VIP host when a VIP guest arrives or makes a reservation.",
    category: "vip",
    config: { notifyHostOnArrival: true, notifyHostOnReservation: true },
  },
  {
    code: "auto-flag-dormant-vip",
    label: "Auto-flag dormant VIPs",
    description: "Flag VIP guests who haven't visited in 90 days — prompting an outreach.",
    category: "vip",
    config: { dormantDays: 90, outreachPrompt: true },
  },
  {
    code: "auto-suggest-table",
    label: "Auto-suggest table for party size",
    description: "Suggest the best available table for a given party size based on capacity and zone.",
    category: "reservations",
    config: { preferSameZone: true, respectMinimumSpend: true },
  },
  {
    code: "auto-close-abandoned-sessions",
    label: "Auto-close abandoned sessions",
    description: "Detect and close sessions with no orders for the configurable threshold period.",
    category: "orders",
    config: { thresholdMinutes: 60, notifyManager: true },
  },
];

// ---------- In-memory store ----------

const rules: AutomationRule[] = RULE_DEFS.map((def, i) => ({
  ...def,
  id: `ar-${i + 1}`,
  enabled: i < 6, // first 6 enabled by default
  createdAt: "2026-07-01T00:00:00Z",
  updatedAt: "2026-07-01T00:00:00Z",
}));

let executions: AutomationExecution[] = [];

// Seed a few plausible execution logs
executions = [
  {
    id: uid("aex"),
    ruleId: "ar-3",
    code: "auto-escalate-orders",
    triggeredAt: "2026-07-27T23:45:00Z",
    result: "Order #ORD-12 breached critical SLA (14.2 min). Manager alerted and order auto-unclaimed from Théo Tremblay.",
    actionApplied: true,
    affectedEntityIds: ["ord-12"],
    durationMs: 45,
  },
  {
    id: uid("aex"),
    ruleId: "ar-2",
    code: "auto-generate-po",
    triggeredAt: "2026-07-27T04:30:00Z",
    result: "Suggested purchase order generated for Belvedere Pure 1.75L (4 units), Dom Pérignon Vintage (3 units), Washers (24 units). Par level deficit detected at end of night.",
    actionApplied: false,
    affectedEntityIds: ["mi-belvedere", "mi-dom", "mi-washers"],
    durationMs: 120,
  },
  {
    id: uid("aex"),
    ruleId: "ar-1",
    code: "auto-release-reservations",
    triggeredAt: "2026-07-27T22:30:00Z",
    result: "Released 2 overdue reservations (RES-08, RES-11) after 30 min grace period. Tables VIP-03 and DNC-02 freed.",
    actionApplied: true,
    affectedEntityIds: ["res-08", "res-11"],
    durationMs: 32,
  },
  {
    id: uid("aex"),
    ruleId: "ar-12",
    code: "auto-flag-dormant-vip",
    triggeredAt: "2026-07-27T08:00:00Z",
    result: "Flagged 3 dormant VIPs (last visit >90 days): Marc Boulanger, Amélie Rousseau, François Lefebvre. Outreach prompt generated.",
    actionApplied: false,
    affectedEntityIds: ["gp-004", "gp-012", "gp-018"],
    durationMs: 68,
  },
  {
    id: uid("aex"),
    ruleId: "ar-8",
    code: "auto-remove-86",
    triggeredAt: "2026-07-26T18:15:00Z",
    result: "Reinstated Belvedere Pure 1.75L from 86 board after PO #PO-03 was received. Bar manager notified.",
    actionApplied: true,
    affectedEntityIds: ["mi-belvedere"],
    durationMs: 28,
  },
];

export const mockAutomationService = {
  /** List all automation rules for the venue. */
  async listRules(): Promise<AutomationRule[]> {
    // TODO(backend): SELECT from automation_rules WHERE venueId = current.
    await delay(300);
    return clone(rules);
  },

  /** Toggle a rule on or off. */
  async setEnabled(ruleId: string, enabled: boolean): Promise<AutomationRule> {
    // TODO(backend): UPDATE automation_rules SET enabled = $1, updatedAt = now() WHERE id = $2.
    await delay(250);
    const idx = rules.findIndex((r) => r.id === ruleId);
    if (idx === -1) throw new Error("Automation rule not found");
    rules[idx] = { ...rules[idx], enabled, updatedAt: new Date().toISOString() };
    return clone(rules[idx]);
  },

  /** Update a rule's configuration. */
  async updateConfig(
    ruleId: string,
    config: Record<string, string | number | boolean>,
  ): Promise<AutomationRule> {
    // TODO(backend): UPDATE automation_rules SET config = $1, updatedAt = now() WHERE id = $2.
    await delay(250);
    const idx = rules.findIndex((r) => r.id === ruleId);
    if (idx === -1) throw new Error("Automation rule not found");
    rules[idx] = { ...rules[idx], config: { ...rules[idx].config, ...config }, updatedAt: new Date().toISOString() };
    return clone(rules[idx]);
  },

  /** Simulate triggering an automation (demo only — in live mode this is a cron job). */
  async triggerRule(ruleId: string): Promise<AutomationExecution> {
    // TODO(backend): remove — demo simulation only.
    await delay(400 + Math.random() * 200);
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) throw new Error("Automation rule not found");
    const resultMessages: Record<AutomationCode, string> = {
      "auto-release-reservations": `Scanned ${Math.ceil(Math.random() * 3)} overdue reservations. Released ${Math.ceil(Math.random() * 2)} beyond grace period.`,
      "auto-generate-po": `Generated suggested PO: ${Math.ceil(Math.random() * 5)} items below par level. Total suggested cost: $${Math.round(Math.random() * 800 + 200)}.`,
      "auto-escalate-orders": `Escalated ${Math.ceil(Math.random() * 2)} overdue orders. ${Math.random() > 0.5 ? "1 auto-unclaimed." : "Manager alerted."}`,
      "auto-detect-duplicates": `Scanned ${Math.ceil(Math.random() * 20)} reservations. Flagged ${Math.ceil(Math.random() * 2)} potential duplicates for review.`,
      "auto-vip-tier-upgrade": `Evaluated ${Math.ceil(Math.random() * 15)} guests. Suggested ${Math.ceil(Math.random() * 3)} tier upgrades pending manager approval.`,
      "auto-event-pricing": `Applied event pricing for 1 active event. ${Math.ceil(Math.random() * 5)} menu items price-overridden.`,
      "auto-close-event": `Closed 1 active event at end time. Night summary generated.`,
      "auto-remove-86": `Checked inventory restocks. Reinstate ${Math.ceil(Math.random() * 2)} items from 86 board.`,
      "auto-pour-cost": `Computed pour costs for ${Math.ceil(Math.random() * 10) + 5} recipes. ${Math.ceil(Math.random() * 2)} flagged above ${rule.config.targetPourCost ?? 0.22} target.`,
      "auto-flag-variance": `Scanned latest stocktake. ${Math.ceil(Math.random() * 2)} lines flagged with variance > ${(rule.config.varianceThresholdPct as number ?? 0.05) * 100}%.`,
      "auto-notify-vip-arrival": `Checked arrivals. ${Math.ceil(Math.random() * 2)} VIP arrivals detected; host notified.`,
      "auto-flag-dormant-vip": `Scanned ${Math.ceil(Math.random() * 30)} VIP profiles. ${Math.ceil(Math.random() * 3)} dormant (>${rule.config.dormantDays ?? 90} days). Outreach prompt generated.`,
      "auto-suggest-table": `Suggested ${Math.ceil(Math.random() * 3)} table(s) for upcoming reservations based on party size and zone availability.`,
      "auto-close-abandoned-sessions": `Scanned ${Math.ceil(Math.random() * 20)} sessions. Auto-closed ${Math.ceil(Math.random() * 2)} abandoned sessions.`,
    };
    const exe: AutomationExecution = {
      id: uid("aex"),
      ruleId: rule.id,
      code: rule.code,
      triggeredAt: new Date().toISOString(),
      result: resultMessages[rule.code] ?? "Automation executed.",
      actionApplied: Math.random() > 0.3,
      affectedEntityIds: [],
      durationMs: Math.round(20 + Math.random() * 150),
    };
    executions.unshift(exe);
    // Update last triggered timestamp on the rule
    const idx = rules.findIndex((r) => r.id === ruleId);
    rules[idx] = { ...rules[idx], lastTriggeredAt: exe.triggeredAt, updatedAt: new Date().toISOString() };
    return clone(exe);
  },

  /** List execution log entries, newest first. */
  async listExecutions(limit = 50): Promise<AutomationExecution[]> {
    // TODO(backend): SELECT from automation_executions WHERE venueId = current ORDER BY triggeredAt DESC LIMIT $1.
    await delay(250);
    return clone(executions.slice(0, limit));
  },
};
