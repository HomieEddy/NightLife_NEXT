"use client";

import type { Broadcast, RevenuePace } from "@/lib/types";

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

export const livePulseService = {
  async listBroadcasts(): Promise<Broadcast[]> {
    return api<Broadcast[]>("/api/floor/broadcasts");
  },

  async sendBroadcast(message: string, sentBy: string): Promise<Broadcast> {
    return api<Broadcast>("/api/floor/broadcasts", {
      method: "POST",
      body: JSON.stringify({ message, sentBy }),
    });
  },

  async getLastCallState(): Promise<{ active: boolean; startedAt: string | null }> {
    return api<{ active: boolean; startedAt: string | null }>("/api/floor/last-call");
  },

  async startLastCall(sentBy: string): Promise<void> {
    await api("/api/floor/last-call", {
      method: "POST",
      body: JSON.stringify({ action: "start", sentBy }),
    });
  },

  async endLastCall(): Promise<void> {
    await api("/api/floor/last-call", {
      method: "POST",
      body: JSON.stringify({ action: "end" }),
    });
  },

  async getRevenuePace(): Promise<RevenuePace> {
    return api<RevenuePace>("/api/floor/revenue-pace");
  },
};
import { liveFetch } from "@/features/shared/live-fetch";
