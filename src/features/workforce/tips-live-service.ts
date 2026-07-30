"use client";

import type { mockTipsService } from "@/features/workforce/tips-mock-service";
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

export const liveTipsService: typeof mockTipsService = {
  async getRule() {
    return api("/api/workforce/tips/rule");
  },

  async saveRule(rule) {
    return api("/api/workforce/tips/rule", {
      method: "POST",
      body: JSON.stringify(rule),
    });
  },

  async listDistributions() {
    return api("/api/workforce/tips/distributions");
  },

  async getDistribution(businessDate) {
    return api(`/api/workforce/tips/distributions?businessDate=${encodeURIComponent(businessDate)}`);
  },

  async saveDistribution(dist) {
    return api("/api/workforce/tips/distributions", {
      method: "POST",
      body: JSON.stringify(dist),
    });
  },

  async closeDistribution(distributionId, closerId) {
    return api(`/api/workforce/tips/distributions/${encodeURIComponent(distributionId)}/close`, {
      method: "PATCH",
      body: JSON.stringify({ closerId }),
    });
  },
};
