"use client";

import type { Incident, IncidentNote, IncidentActionItem, IncidentTemplate } from "@/lib/types";
import type { mockIncidentService } from "@/features/safety/mock-service";
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

export const liveIncidentService: typeof mockIncidentService = {
  async listIncidents(filter?) {
    const params = filter ? `?${new URLSearchParams(filter as Record<string, string>).toString()}` : "";
    return api<Incident[]>(`/api/incidents${params}`);
  },

  async getIncident(id: string) {
    const res = await liveFetch(`/api/incidents/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to get incident ${id}`);
    return res.json() as Promise<Incident>;
  },

  async listNotes(incidentId: string) {
    return api<IncidentNote[]>(`/api/incidents/${encodeURIComponent(incidentId)}/notes`);
  },

  async reportIncident(input) {
    return api<Incident>("/api/incidents", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async addNote(incidentId: string, input) {
    return api<IncidentNote>(`/api/incidents/${encodeURIComponent(incidentId)}/notes`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async setStatus(incidentId: string, status: string) {
    return api<Incident>(`/api/incidents/${encodeURIComponent(incidentId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },

  async markReportable(
    id: string,
    input: { regulatoryDeadline: string; regulatoryAuthority: string; staffId: string; staffName: string },
  ) {
    return api<Incident | null>(`/api/incidents/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ reportable: true, ...input }),
    });
  },

  async recordReportedToAuthority(incidentId: string, staffId: string) {
    return api<Incident>(`/api/incidents/${encodeURIComponent(incidentId)}/report-to-authority`, {
      method: "POST",
      body: JSON.stringify({ staffId }),
    });
  },

  async listActionItems() {
    return api<IncidentActionItem[]>("/api/incidents/action-items");
  },

  async createActionItem(input) {
    return api<IncidentActionItem>("/api/incidents/action-items", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async completeActionItem(itemId: string) {
    await api<{ ok: boolean }>(`/api/incidents/action-items/${encodeURIComponent(itemId)}/complete`, {
      method: "POST",
    });
  },

  async getIncidentsByZone(zoneId: string) {
    return api<Incident[]>(`/api/incidents/by-zone?zoneId=${encodeURIComponent(zoneId)}`);
  },

  async listTemplates() {
    return api<IncidentTemplate[]>("/api/incidents/templates");
  },

  async fileFromTemplate(templateId: string, overrides) {
    return api<Incident>(`/api/incidents/templates/${encodeURIComponent(templateId)}/file`, {
      method: "POST",
      body: JSON.stringify(overrides),
    });
  },
};
