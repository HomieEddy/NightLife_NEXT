"use client";

import type {
  Admission,
  CoatCheckClaim,
  CoatCheckTicket,
  DoorRefusal,
  OccupancyEvent,
} from "@/lib/types";
import type { mockDoorService } from "@/features/door/mock-service";
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

export const liveDoorService: typeof mockDoorService = {
  async getOccupancy(businessDate?: string) {
    const params = businessDate ? `?businessDate=${encodeURIComponent(businessDate)}` : "";
    return api(`/api/door/occupancy${params}`);
  },

  async listOccupancyEvents(businessDate?: string) {
    const params = businessDate ? `?businessDate=${encodeURIComponent(businessDate)}` : "";
    return api<OccupancyEvent[]>(`/api/door/occupancy/events${params}`);
  },

  async adjustOccupancy(delta: number, reason: string, staffId: string) {
    return api<{ ok: boolean; current: number; error?: string }>("/api/door/occupancy/adjust", {
      method: "POST",
      body: JSON.stringify({ delta, reason, staffId }),
    });
  },

  async listAdmissions(businessDate?: string) {
    const params = businessDate ? `?businessDate=${encodeURIComponent(businessDate)}` : "";
    return api<Admission[]>(`/api/door/admissions${params}`);
  },

  async getAdmission(id: string) {
    const res = await liveFetch(`/api/door/admissions/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to get admission ${id}`);
    return res.json() as Promise<Admission>;
  },

  async admit(input) {
    return api<Admission>("/api/door/admissions", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async reEnter(admissionId: string, staffId: string, staffName: string) {
    return api<Admission | null>(`/api/door/admissions/${encodeURIComponent(admissionId)}/re-enter`, {
      method: "POST",
      body: JSON.stringify({ staffId, staffName }),
    });
  },

  async recordExit(admissionId: string, staffId: string) {
    return api<Admission | null>(`/api/door/admissions/${encodeURIComponent(admissionId)}/exit`, {
      method: "POST",
      body: JSON.stringify({ staffId }),
    });
  },

  async admitBannedOverride(input) {
    return api<Admission>("/api/door/admissions/banned-override", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async listCoatCheckTickets(businessDate?: string) {
    const params = businessDate ? `?businessDate=${encodeURIComponent(businessDate)}` : "";
    return api<CoatCheckTicket[]>(`/api/door/coat-check${params}`);
  },

  async checkInCoat(input) {
    return api<CoatCheckTicket>("/api/door/coat-check", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async claimCoat(ticketId: string) {
    return api<CoatCheckTicket | null>(`/api/door/coat-check/${encodeURIComponent(ticketId)}/claim`, {
      method: "POST",
    });
  },

  async getEvacuationState() {
    return api<{ state: string; headcountAtEvacuation: number }>("/api/door/evacuation");
  },

  async evacuate(staffId: string, staffName: string) {
    return api<{ headcount: number }>("/api/door/evacuation", {
      method: "POST",
      body: JSON.stringify({ staffId, staffName }),
    });
  },

  async resumeEvacuation(staffId: string, staffName: string) {
    await api<void>("/api/door/evacuation/resume", {
      method: "POST",
      body: JSON.stringify({ staffId, staffName }),
    });
  },

  async admitCapacityOverride(input) {
    return api<Admission>("/api/door/admissions/capacity-override", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async getZoneOccupancy(zoneId: string) {
    return api<{ zoneId: string; current: number; capacity: number | null }>(
      `/api/door/zone-occupancy?zoneId=${encodeURIComponent(zoneId)}`,
    );
  },

  async getOccupancyByZone() {
    return api<{ zoneId: string; zoneName: string; current: number; capacity: number | null }[]>(
      "/api/door/zone-occupancy",
    );
  },

  async checkZoneCapacity(zoneId: string, partySize: number) {
    return api<{ allowed: boolean; current: number; capacity: number | null }>(
      "/api/door/zone-occupancy/check",
      { method: "POST", body: JSON.stringify({ zoneId, partySize }) },
    );
  },

  async admitGroup(input) {
    return api<Admission[]>("/api/door/admissions/group", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async recordRefusal(input) {
    return api<DoorRefusal>("/api/door/refusals", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async listRefusals(businessDate?: string) {
    const params = businessDate ? `?businessDate=${encodeURIComponent(businessDate)}` : "";
    return api<DoorRefusal[]>(`/api/door/refusals${params}`);
  },

  async reportLostTicket(description: string, staffName: string) {
    return api<CoatCheckClaim>("/api/door/coat-check/claims", {
      method: "POST",
      body: JSON.stringify({ claimType: "lost-ticket", description, staffName }),
    });
  },

  async reportLostItem(ticketId: string, description: string, staffName: string) {
    return api<CoatCheckClaim>("/api/door/coat-check/claims", {
      method: "POST",
      body: JSON.stringify({ claimType: "lost-item", ticketId, description, staffName }),
    });
  },

  async resolveClaim(claimId: string, resolution: string, staffId: string) {
    return api<CoatCheckClaim | null>(`/api/door/coat-check/claims/${encodeURIComponent(claimId)}/resolve`, {
      method: "POST",
      body: JSON.stringify({ resolution, staffId }),
    });
  },
};
