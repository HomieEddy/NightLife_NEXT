"use client";

import type {
  AutomationRule,
  AutomationExecution,
} from "@/lib/types";
import { liveFetch } from "./live-fetch";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await liveFetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request to ${path} failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const liveAutomationService = {
  // TODO(backend): implement /api/automations route handlers.

  async listRules(): Promise<AutomationRule[]> {
    return api<AutomationRule[]>("/api/automations/rules");
  },
  async setEnabled(ruleId: string, enabled: boolean): Promise<AutomationRule> {
    return api<AutomationRule>(`/api/automations/rules/${ruleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
  },
  async updateConfig(ruleId: string, config: Record<string, string | number | boolean>): Promise<AutomationRule> {
    return api<AutomationRule>(`/api/automations/rules/${ruleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config }),
    });
  },
  async triggerRule(): Promise<AutomationExecution> {
    throw new Error("triggerRule is demo-only; use /api/jobs/* cron handlers in live mode.");
  },
  async listExecutions(limit = 50): Promise<AutomationExecution[]> {
    return api<AutomationExecution[]>(`/api/automations/executions?limit=${limit}`);
  },
};
