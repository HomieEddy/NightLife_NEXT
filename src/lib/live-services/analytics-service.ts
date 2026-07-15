"use client";

import type { AnalyticsSummary } from "@/lib/types";
import type { HistoricalAnalytics } from "@/lib/types";

async function api<T>(path: string): Promise<T> {
  const res = await liveFetch(path);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request to ${path} failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const liveAnalyticsService = {
  async getSummary(): Promise<AnalyticsSummary> {
    return api<AnalyticsSummary>("/api/analytics");
  },

  async getHistorical(fromISO: string, toISO: string): Promise<HistoricalAnalytics> {
    return api<HistoricalAnalytics>(`/api/analytics?from=${fromISO}&to=${toISO}`);
  },
};
import { liveFetch } from "./live-fetch";
