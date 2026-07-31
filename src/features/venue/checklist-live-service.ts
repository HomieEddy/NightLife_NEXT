"use client";

import type { mockChecklistService } from "@/features/venue/checklist-mock-service";
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

async function apiNoBody(path: string, init?: RequestInit): Promise<void> {
  const res = await liveFetch(path, init ?? {});
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request to ${path} failed (${res.status})`);
  }
}

export const liveChecklistService: typeof mockChecklistService = {
  // ── Templates ──────────────────────────────────────────────

  async listTemplates(type) {
    const qs = type ? `?type=${encodeURIComponent(type)}` : "";
    return api(`/api/checklists/templates${qs}`);
  },

  async getTemplate(id) {
    return api(`/api/checklists/templates/${encodeURIComponent(id)}`);
  },

  async createTemplate(input) {
    return api("/api/checklists/templates", { method: "POST", body: JSON.stringify(input) });
  },

  async updateTemplate(id, patch) {
    return api(`/api/checklists/templates/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  async deleteTemplate(id) {
    await apiNoBody(`/api/checklists/templates/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  // ── Runs ───────────────────────────────────────────────────

  async listRuns(filter) {
    const params = new URLSearchParams();
    if (filter?.type) params.set("type", filter.type);
    if (filter?.businessDate) params.set("businessDate", filter.businessDate);
    const qs = params.toString();
    return api(`/api/checklists/runs${qs ? `?${qs}` : ""}`);
  },

  async getRun(id) {
    return api(`/api/checklists/runs/${encodeURIComponent(id)}`);
  },

  async startRun(input) {
    return api("/api/checklists/runs", { method: "POST", body: JSON.stringify(input) });
  },

  async checkItem(runId, templateItemId, checked, staffId, note) {
    return api(`/api/checklists/runs/${encodeURIComponent(runId)}/check`, {
      method: "PATCH",
      body: JSON.stringify({ templateItemId, checked, staffId, note }),
    });
  },

  async completeRun(runId, staffId, staffName) {
    return api(`/api/checklists/runs/${encodeURIComponent(runId)}/complete`, {
      method: "POST",
      body: JSON.stringify({ staffId, staffName }),
    });
  },

  async skipRun(runId) {
    return api(`/api/checklists/runs/${encodeURIComponent(runId)}/skip`, { method: "POST" });
  },
};
