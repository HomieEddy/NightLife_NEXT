"use client";

import type { WaitlistEntry, WaitlistStatus } from "@/lib/types";
import type { mockWaitlistService, WaitlistEntryWithPosition } from "@/features/door/waitlist-mock-service";
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

export const liveWaitlistService: typeof mockWaitlistService = {
  async listEntries(status?: WaitlistStatus) {
    const params = status ? `?status=${encodeURIComponent(status)}` : "";
    return api<WaitlistEntryWithPosition[]>(`/api/waitlist/entries${params}`);
  },

  async join(input) {
    return api<WaitlistEntry>("/api/waitlist/entries", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async setStatus(id: string, status: WaitlistStatus) {
    return api<WaitlistEntry | null>(`/api/waitlist/entries/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },
};
