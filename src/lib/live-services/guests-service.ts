"use client";

import type { GuestSession, HelpRequest, HelpRequestType } from "@/lib/types";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request to ${path} failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const liveGuestsService = {
  async listSessions(status?: GuestSession["status"]): Promise<GuestSession[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    return api<GuestSession[]>(`/api/sessions${qs}`);
  },

  async requestSession(input: {
    tableId: string;
    tableCode: string;
    zoneName: string;
    displayName: string;
    partySize: number;
  }): Promise<GuestSession> {
    return api<GuestSession>("/api/guest/join", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async getSession(sessionId: string): Promise<GuestSession | null> {
    const res = await fetch(`/api/guest/session`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("Failed to get session");
    return res.json();
  },

  async requestClosure(sessionId: string): Promise<GuestSession | null> {
    return api<GuestSession>("/api/guest/session", { method: "POST" });
  },

  async setSessionStatus(
    sessionId: string,
    status: GuestSession["status"],
  ): Promise<GuestSession | null> {
    return api<GuestSession>(`/api/sessions/${encodeURIComponent(sessionId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },

  async listHelpRequests(): Promise<HelpRequest[]> {
    return api<HelpRequest[]>("/api/help-requests");
  },

  async createHelpRequest(input: {
    sessionId: string;
    tableCode: string;
    zoneName: string;
    guestName: string;
    type: HelpRequestType;
  }): Promise<HelpRequest> {
    return api<HelpRequest>("/api/guest/help", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async setHelpRequestStatus(
    requestId: string,
    status: HelpRequest["status"],
  ): Promise<HelpRequest | null> {
    return api<HelpRequest>(`/api/help-requests/${encodeURIComponent(requestId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },
};
