"use client";

import type { mockCommissionService } from "@/features/workforce/commission-mock-service";
import { liveFetch } from "@/features/shared/live-fetch";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await liveFetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request to ${path} failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const liveCommissionService: typeof mockCommissionService = {
  async listRules(staffId) {
    const qs = staffId ? `?staffId=${encodeURIComponent(staffId)}` : "";
    return api(`/api/workforce/commission/rules${qs}`);
  },

  async saveRule(rule) {
    return api("/api/workforce/commission/rules", {
      method: "POST",
      body: JSON.stringify(rule),
    });
  },

  async listStatements(staffId) {
    const qs = staffId ? `?staffId=${encodeURIComponent(staffId)}` : "";
    return api(`/api/workforce/commission/statements${qs}`);
  },

  async saveStatement(stmt) {
    return api("/api/workforce/commission/statements", {
      method: "POST",
      body: JSON.stringify(stmt),
    });
  },

  async approveStatement(statementId, approverId) {
    return api(`/api/workforce/commission/statements/${encodeURIComponent(statementId)}/approve`, {
      method: "PATCH",
      body: JSON.stringify({ approverId }),
    });
  },
};
