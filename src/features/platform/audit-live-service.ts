"use client";

import type { AuditEntry } from "@/lib/types";

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

// TODO(backend): plan 16 graduation — /api/audit route handler, manager-only
// (audit:read), reading the insert-only audit_entries table.
export const liveAuditService = {
  async record(input: {
    actorStaffId: string;
    actorName: string;
    action: string;
    targetType: string;
    targetId: string;
    summary: string;
    metadata?: Record<string, unknown>;
  }): Promise<AuditEntry> {
    return api<AuditEntry>("/api/audit", { method: "POST", body: JSON.stringify(input) });
  },

  async listEntries(filter?: {
    actorStaffId?: string;
    action?: string;
    from?: string;
    to?: string;
  }): Promise<AuditEntry[]> {
    const params = new URLSearchParams();
    if (filter?.actorStaffId) params.set("actorStaffId", filter.actorStaffId);
    if (filter?.action) params.set("action", filter.action);
    if (filter?.from) params.set("from", filter.from);
    if (filter?.to) params.set("to", filter.to);
    const qs = params.toString();
    return api<AuditEntry[]>(`/api/audit${qs ? `?${qs}` : ""}`);
  },
};

import { liveFetch } from "@/features/shared/live-fetch";
