"use client";

import type {
  AnalyticsSummary,
  HistoricalAnalytics,
  NightComparison,
  NightForecast,
  PerHourAnalytics,
  DoorToTableFunnel,
  TableTurnAnalytics,
  OrderSlaAnalytics,
  CompVoidRatioAnalytics,
  PromoterPerformanceReport,
  IncidentPatternReport,
  GuestRetentionMetrics,
  BottleServiceAnalytics,
  CapacityUtilizationAnalytics,
  NightSummary,
  ReportExport,
  ReportMetric,
} from "@/lib/types";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await liveFetch(path, init);
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

  // ---------- Phase 4: Analytics Depth — live API endpoints ----------

  async getNightComparison(): Promise<NightComparison> {
    return api<NightComparison>("/api/analytics?type=comparison");
  },
  async getNightForecast(): Promise<NightForecast> {
    return api<NightForecast>("/api/analytics?type=forecast");
  },
  async getPerHourAnalytics(_fromISO: string, _toISO: string): Promise<PerHourAnalytics> {
    return api<PerHourAnalytics>("/api/analytics?type=per-hour");
  },
  async getDoorToTableFunnel(_fromISO: string, _toISO: string): Promise<DoorToTableFunnel> {
    return api<DoorToTableFunnel>("/api/analytics?type=door-to-table");
  },
  async getTableTurnAnalytics(_fromISO: string, _toISO: string): Promise<TableTurnAnalytics> {
    return api<TableTurnAnalytics>("/api/analytics?type=table-turn");
  },
  async getOrderSlaAnalytics(_fromISO: string, _toISO: string): Promise<OrderSlaAnalytics> {
    return api<OrderSlaAnalytics>("/api/analytics?type=order-sla");
  },
  async getCompVoidRatioAnalytics(_fromISO: string, _toISO: string): Promise<CompVoidRatioAnalytics> {
    return api<CompVoidRatioAnalytics>("/api/analytics?type=comp-void");
  },
  async exportReportCsv(
    reportName: string, metrics: ReportMetric[], fromISO: string, toISO: string, recipient?: string,
  ): Promise<ReportExport> {
    return api<ReportExport>("/api/analytics?type=export-csv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportName, metrics, from: fromISO, to: toISO, recipient }),
    });
  },
  async getPromoterPerformanceReport(_fromISO: string, _toISO: string): Promise<PromoterPerformanceReport[]> {
    return api<PromoterPerformanceReport[]>("/api/analytics?type=promoter-performance");
  },
  async getIncidentPatternReport(_fromISO: string, _toISO: string): Promise<IncidentPatternReport> {
    return api<IncidentPatternReport>("/api/analytics?type=incident-pattern");
  },
  async getGuestRetentionMetrics(_fromISO: string, _toISO: string): Promise<GuestRetentionMetrics> {
    return api<GuestRetentionMetrics>("/api/analytics?type=guest-retention");
  },
  async getBottleServiceAnalytics(_fromISO: string, _toISO: string): Promise<BottleServiceAnalytics> {
    return api<BottleServiceAnalytics>("/api/analytics?type=bottle-service");
  },
  async getCapacityUtilizationAnalytics(_fromISO: string, _toISO: string): Promise<CapacityUtilizationAnalytics> {
    return api<CapacityUtilizationAnalytics>("/api/analytics?type=capacity");
  },
  async getNightSummary(businessDate: string): Promise<NightSummary> {
    return api<NightSummary>(`/api/analytics?type=night-summary&date=${businessDate}`);
  },
};
import { liveFetch } from "@/features/shared/live-fetch";
