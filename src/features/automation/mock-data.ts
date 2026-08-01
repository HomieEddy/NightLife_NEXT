/**
 * Automation rule seed data. One definition per AM code.
 *
 * Demo: imported by mock-service.ts to seed the in-memory store.
 * Live: imported by prisma/seed.ts to create AutomationRule rows.
 */

import type { AutomationCode, AutomationRule } from "@/lib/types";

export interface AutomationRuleDef {
  code: AutomationCode;
  label: string;
  description: string;
  category: AutomationRule["category"];
  config: Record<string, string | number | boolean>;
  /** First N rules are enabled by default in demo mode. */
  enabled: boolean;
}

export const AUTOMATION_RULE_DEFS: AutomationRuleDef[] = [
  {
    code: "auto-release-reservations",
    label: "Auto-release overdue reservations",
    description: "Release reservations that haven't checked in after the configurable grace period.",
    category: "reservations",
    config: { graceMinutes: 30, notifyManager: true },
    enabled: true,
  },
  {
    code: "auto-generate-po",
    label: "Auto-generate purchase orders",
    description: "Generate a suggested purchase order whenever stock drops below par levels.",
    category: "inventory",
    config: { checkFrequencyMinutes: 60, autoSubmit: false },
    enabled: true,
  },
  {
    code: "auto-escalate-orders",
    label: "Auto-escalate overdue orders",
    description: "Escalate orders that breach their SLA deadline — warn, alert manager, then auto-unclaim.",
    category: "orders",
    config: { warnMinutes: 6, criticalMinutes: 12, autoUnclaim: true },
    enabled: true,
  },
  {
    code: "auto-detect-duplicates",
    label: "Auto-detect duplicate reservations",
    description: "Flag reservations that share the same phone or email on the same date.",
    category: "reservations",
    config: { matchFields: "phone,email", autoFlag: true },
    enabled: true,
  },
  {
    code: "auto-vip-tier-upgrade",
    label: "Auto-flag VIP tier upgrades",
    description: "Suggest a VIP tier upgrade when a guest's trailing-90-day spend exceeds the configurable threshold.",
    category: "vip",
    config: { spendThresholdCents: 500000, requireManagerApproval: true },
    enabled: true,
  },
  {
    code: "auto-event-pricing",
    label: "Auto-apply event pricing",
    description: "Automatically apply event-specific menu pricing and packages during the event window.",
    category: "events",
    config: { applyMinutesBefore: 30, revertMinutesAfter: 30 },
    enabled: true,
  },
  {
    code: "auto-close-event",
    label: "Auto-close event",
    description: "Automatically close an event at its configured end time.",
    category: "events",
    config: { closeAtEndTime: true, sendNightSummary: true },
    enabled: false,
  },
  {
    code: "auto-remove-86",
    label: "Auto-remove from 86 board",
    description: "Reinstate items from the 86 board when inventory is restocked via purchase order receipt.",
    category: "inventory",
    config: { checkOnStockIn: true, notifyBarManager: true },
    enabled: false,
  },
  {
    code: "auto-pour-cost",
    label: "Auto-calculate pour cost",
    description: "Calculate pour cost per drink from recipe BOM + current average cost, flagging pours above target.",
    category: "inventory",
    config: { targetPourCost: 0.22, flagAboveTarget: true },
    enabled: false,
  },
  {
    code: "auto-flag-variance",
    label: "Auto-flag unusual stocktake variance",
    description: "Flag stocktake lines with variance exceeding the configurable percentage threshold.",
    category: "inventory",
    config: { varianceThresholdPct: 0.05, requireInvestigationNote: true },
    enabled: false,
  },
  {
    code: "auto-notify-vip-arrival",
    label: "Auto-notify VIP host on arrival",
    description: "Notify the assigned VIP host when a VIP guest arrives or makes a reservation.",
    category: "vip",
    config: { notifyHostOnArrival: true, notifyHostOnReservation: true },
    enabled: false,
  },
  {
    code: "auto-flag-dormant-vip",
    label: "Auto-flag dormant VIPs",
    description: "Flag VIP guests who haven't visited in 90 days — prompting an outreach.",
    category: "vip",
    config: { dormantDays: 90, outreachPrompt: true },
    enabled: false,
  },
  {
    code: "auto-suggest-table",
    label: "Auto-suggest table for party size",
    description: "Suggest the best available table for a given party size based on capacity and zone.",
    category: "reservations",
    config: { preferSameZone: true, respectMinimumSpend: true },
    enabled: false,
  },
  {
    code: "auto-close-abandoned-sessions",
    label: "Auto-close abandoned sessions",
    description: "Detect and close sessions with no orders for the configurable threshold period.",
    category: "orders",
    config: { thresholdMinutes: 60, notifyManager: true },
    enabled: false,
  },
];
