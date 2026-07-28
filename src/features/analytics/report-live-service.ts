"use client";

import type { SavedReport, ReportSchedule, ReportMetric } from "@/lib/types";

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

export const liveReportService = {
  async listReports(): Promise<SavedReport[]> {
    return api<SavedReport[]>("/api/reports");
  },

  async createReport(
    input: Omit<SavedReport, "id" | "createdAt" | "lastRunAt">,
  ): Promise<SavedReport> {
    return api<SavedReport>("/api/reports", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async updateReport(
    reportId: string,
    patch: Partial<Omit<SavedReport, "id" | "createdAt">>,
  ): Promise<SavedReport | null> {
    return api<SavedReport>(`/api/reports/${encodeURIComponent(reportId)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  async deleteReport(reportId: string): Promise<void> {
    await api<{ ok: boolean }>(`/api/reports/${encodeURIComponent(reportId)}`, {
      method: "DELETE",
    });
  },

  async markRun(reportId: string): Promise<void> {
    await api<unknown>(`/api/reports/${encodeURIComponent(reportId)}/run`, {
      method: "POST",
    });
  },
};
import { liveFetch } from "@/features/shared/live-fetch";
