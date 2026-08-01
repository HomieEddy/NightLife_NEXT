"use client";

import type {
  Lead, LeadStatus, PlanConfig, TelemetryLink, Tenant, TenantPlan,
} from "@/lib/types";
import type { OnboardingConfig } from "@/features/platform/admin-mock-service";
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

export const liveAdminService = {
  // Leads
  async listLeads(): Promise<Lead[]> {
    return api<Lead[]>("/api/platform/leads");
  },
  async getLead(leadId: string): Promise<Lead | null> {
    return api<Lead | null>(`/api/platform/leads/${encodeURIComponent(leadId)}`);
  },
  async createLead(input: Omit<Lead, "id" | "status" | "activity" | "createdAt">): Promise<Lead> {
    return api<Lead>("/api/platform/leads", { method: "POST", body: JSON.stringify(input) });
  },
  async updateLead(leadId: string, patch: Partial<Omit<Lead, "id" | "activity" | "createdAt">>): Promise<Lead | null> {
    return api<Lead | null>(`/api/platform/leads/${encodeURIComponent(leadId)}`, { method: "PATCH", body: JSON.stringify(patch) });
  },
  async deleteLead(leadId: string): Promise<void> {
    await api(`/api/platform/leads/${encodeURIComponent(leadId)}`, { method: "DELETE" });
  },
  async setLeadStatus(leadId: string, status: LeadStatus): Promise<Lead | null> {
    return api<Lead | null>(`/api/platform/leads/${encodeURIComponent(leadId)}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
  },
  async addLeadNote(leadId: string, text: string): Promise<Lead | null> {
    return api<Lead | null>(`/api/platform/leads/${encodeURIComponent(leadId)}/notes`, { method: "POST", body: JSON.stringify({ text }) });
  },

  // Tenants
  async listTenants(): Promise<Tenant[]> {
    return api<Tenant[]>("/api/platform/tenants");
  },
  async getTenant(tenantId: string): Promise<Tenant | null> {
    return api<Tenant | null>(`/api/platform/tenants/${encodeURIComponent(tenantId)}`);
  },
  async updateTenant(tenantId: string, patch: Partial<Pick<Tenant, "plan" | "status" | "venueName" | "city">>): Promise<Tenant | null> {
    return api<Tenant | null>(`/api/platform/tenants/${encodeURIComponent(tenantId)}`, { method: "PATCH", body: JSON.stringify(patch) });
  },
  async deleteTenant(tenantId: string): Promise<void> {
    await api(`/api/platform/tenants/${encodeURIComponent(tenantId)}`, { method: "DELETE" });
  },
  async provisionVenue(input: { venueName: string; city: string }): Promise<Tenant> {
    return api<Tenant>("/api/platform/tenants", { method: "POST", body: JSON.stringify(input) });
  },
  async onboardTenant(config: OnboardingConfig): Promise<Tenant> {
    return api<Tenant>("/api/platform/tenants", { method: "POST", body: JSON.stringify(config) });
  },

  // Plan configs
  async getPlanConfigs(): Promise<PlanConfig[]> {
    return api<PlanConfig[]>("/api/platform/plan-configs");
  },
  async updatePlanConfig(id: TenantPlan, patch: Partial<Omit<PlanConfig, "id">>): Promise<PlanConfig | null> {
    return api<PlanConfig | null>("/api/platform/plan-configs", { method: "PATCH", body: JSON.stringify({ id, ...patch }) });
  },

  // Telemetry links
  async listTelemetryLinks(): Promise<TelemetryLink[]> {
    return api<TelemetryLink[]>("/api/platform/telemetry");
  },
  async createTelemetryLink(input: Omit<TelemetryLink, "id">): Promise<TelemetryLink> {
    return api<TelemetryLink>("/api/platform/telemetry", { method: "POST", body: JSON.stringify(input) });
  },
  async updateTelemetryLink(id: string, patch: Partial<Omit<TelemetryLink, "id">>): Promise<TelemetryLink | null> {
    return api<TelemetryLink | null>(`/api/platform/telemetry/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
  },
  async deleteTelemetryLink(id: string): Promise<void> {
    await api(`/api/platform/telemetry/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
};
