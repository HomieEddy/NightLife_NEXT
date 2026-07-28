"use client";

import type {
  AutomationRule,
  AutomationExecution,
} from "@/lib/types";
import { liveFetch } from "@/features/shared/live-fetch";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await liveFetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request to ${path} failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const liveAutomationService = {
  async listRules(): Promise<AutomationRule[]> {
    return api<AutomationRule[]>("/api/automations/rules");
  },
  async setEnabled(ruleId: string, enabled: boolean): Promise<AutomationRule> {
    return api<AutomationRule>("/api/automations/rules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruleId, enabled }),
    });
  },
  async updateConfig(ruleId: string, config: Record<string, string | number | boolean>): Promise<AutomationRule> {
    return api<AutomationRule>("/api/automations/rules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruleId, config }),
    });
  },
  async triggerRule(): Promise<AutomationExecution> {
    throw new Error("triggerRule is demo-only; automations run via /api/jobs/* cron handlers in live mode.");
  },
  async listExecutions(limit = 50): Promise<AutomationExecution[]> {
    return api<AutomationExecution[]>(`/api/automations/executions?limit=${limit}`);
  },
};
