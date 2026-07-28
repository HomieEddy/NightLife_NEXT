"use client";

import type { Venue, VenueTable, Zone } from "@/lib/types";

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

export const liveVenueService = {
  async getVenue(): Promise<Venue> {
    return api<Venue>("/api/venue");
  },

  async getVenueSnapshot(): Promise<Venue> {
    return api<Venue>("/api/venue");
  },

  async updateVenue(patch: Partial<Omit<Venue, "id">>): Promise<Venue> {
    return api<Venue>("/api/venue", { method: "PATCH", body: JSON.stringify(patch) });
  },

  async listZones(): Promise<Zone[]> {
    return api<Zone[]>("/api/zones");
  },

  async createZone(input: Omit<Zone, "id" | "venueId" | "tableCount">): Promise<Zone> {
    return api<Zone>("/api/zones", { method: "POST", body: JSON.stringify(input) });
  },

  async updateZone(zoneId: string, patch: Partial<Omit<Zone, "id" | "venueId">>): Promise<Zone | null> {
    return api<Zone | null>(`/api/zones/${zoneId}`, { method: "PATCH", body: JSON.stringify(patch) });
  },

  async deleteZone(zoneId: string): Promise<{ ok: boolean; blockedBy?: number }> {
    return api<{ ok: boolean; blockedBy?: number }>(`/api/zones/${zoneId}`, { method: "DELETE" });
  },

  async createTable(input: Omit<VenueTable, "id" | "qrSlug">): Promise<VenueTable> {
    return api<VenueTable>("/api/tables", { method: "POST", body: JSON.stringify(input) });
  },

  async setTablePosition(tableId: string, x: number, y: number): Promise<void> {
    const { setTablePositionAction } = await import("@/server/actions/table-actions");
    const result = await setTablePositionAction(tableId, x, y);
    if ("error" in result) throw new Error(result.error);
  },

  async updateTable(
    tableId: string,
    patch: Partial<Omit<VenueTable, "id" | "qrSlug">>,
  ): Promise<VenueTable | null> {
    return api<VenueTable | null>(`/api/tables/${tableId}`, { method: "PATCH", body: JSON.stringify(patch) });
  },

  async deleteTable(tableId: string): Promise<void> {
    await api<{ ok: boolean }>(`/api/tables/${tableId}`, { method: "DELETE" });
  },

  async listTables(zoneId?: string): Promise<VenueTable[]> {
    const qs = zoneId ? `?zoneId=${encodeURIComponent(zoneId)}` : "";
    return api<VenueTable[]>(`/api/tables${qs}`);
  },

  async getTableBySlug(qrSlug: string): Promise<{ table: VenueTable; zone: Zone; venue: Venue } | null> {
    const res = await liveFetch(`/api/tables/by-slug/${encodeURIComponent(qrSlug)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to resolve table ${qrSlug}`);
    return res.json();
  },

  async regenerateToken(tableId: string): Promise<void> {
    await api<{ tokenVersion: number }>(`/api/tables/${encodeURIComponent(tableId)}/regenerate-token`, {
      method: "POST",
    });
  },

  async setTableStatus(tableId: string, status: VenueTable["status"]): Promise<VenueTable | null> {
    const { setTableStatusAction } = await import("@/server/actions/table-actions");
    const result = await setTableStatusAction(tableId, status);
    if ("error" in result) throw new Error(result.error);
    return result.data;
  },
};
import { liveFetch } from "@/features/shared/live-fetch";
