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

  // ---------- Phase 4: Analytics Depth — live stubs that hit real API endpoints ----------
  // TODO(backend): implement route handlers for each of these on the live track.

  async getNightComparison(): Promise<NightComparison> {
    return api<NightComparison>("/api/analytics/comparison");
  },
  async getNightForecast(): Promise<NightForecast> {
    return api<NightForecast>("/api/analytics/forecast");
  },
  async getPerHourAnalytics(_fromISO: string, _toISO: string): Promise<PerHourAnalytics> {
    return api<PerHourAnalytics>(`/api/analytics/per-hour?from=${_fromISO}&to=${_toISO}`);
  },
  async getDoorToTableFunnel(_fromISO: string, _toISO: string): Promise<DoorToTableFunnel> {
    return api<DoorToTableFunnel>(`/api/analytics/door-to-table?from=${_fromISO}&to=${_toISO}`);
  },
  async getTableTurnAnalytics(_fromISO: string, _toISO: string): Promise<TableTurnAnalytics> {
    return api<TableTurnAnalytics>(`/api/analytics/table-turn?from=${_fromISO}&to=${_toISO}`);
  },
  async getOrderSlaAnalytics(_fromISO: string, _toISO: string): Promise<OrderSlaAnalytics> {
    return api<OrderSlaAnalytics>(`/api/analytics/order-sla?from=${_fromISO}&to=${_toISO}`);
  },
  async getCompVoidRatioAnalytics(_fromISO: string, _toISO: string): Promise<CompVoidRatioAnalytics> {
    return api<CompVoidRatioAnalytics>(`/api/analytics/comp-void?from=${_fromISO}&to=${_toISO}`);
  },
  async exportReportCsv(
    reportName: string, metrics: ReportMetric[], fromISO: string, toISO: string, recipient?: string,
  ): Promise<ReportExport> {
    return api<ReportExport>("/api/analytics/export-csv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportName, metrics, from: fromISO, to: toISO, recipient }),
    });
  },
  async getPromoterPerformanceReport(_fromISO: string, _toISO: string): Promise<PromoterPerformanceReport[]> {
    return api<PromoterPerformanceReport[]>(`/api/analytics/promoter-performance?from=${_fromISO}&to=${_toISO}`);
  },
  async getIncidentPatternReport(_fromISO: string, _toISO: string): Promise<IncidentPatternReport> {
    return api<IncidentPatternReport>(`/api/analytics/incident-pattern?from=${_fromISO}&to=${_toISO}`);
  },
  async getGuestRetentionMetrics(_fromISO: string, _toISO: string): Promise<GuestRetentionMetrics> {
    return api<GuestRetentionMetrics>(`/api/analytics/guest-retention?from=${_fromISO}&to=${_toISO}`);
  },
  async getBottleServiceAnalytics(_fromISO: string, _toISO: string): Promise<BottleServiceAnalytics> {
    return api<BottleServiceAnalytics>(`/api/analytics/bottle-service?from=${_fromISO}&to=${_toISO}`);
  },
  async getCapacityUtilizationAnalytics(_fromISO: string, _toISO: string): Promise<CapacityUtilizationAnalytics> {
    return api<CapacityUtilizationAnalytics>(`/api/analytics/capacity?from=${_fromISO}&to=${_toISO}`);
  },
  async getNightSummary(businessDate: string): Promise<NightSummary> {
    return api<NightSummary>(`/api/analytics/night-summary?date=${businessDate}`);
  },
};
import { liveFetch } from "./live-fetch";
