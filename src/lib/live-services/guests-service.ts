"use client";

import type { GuestSession, HelpRequest, HelpRequestType, SettlementMethod } from "@/lib/types";

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
    token?: string;
  }): Promise<GuestSession> {
    return api<GuestSession>("/api/guest/join", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async getSession(_sessionId: string): Promise<GuestSession | null> {
    const res = await liveFetch(`/api/guest/session`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("Failed to get session");
    return res.json();
  },

  async requestClosure(_sessionId: string): Promise<GuestSession | null> {
    return api<GuestSession>("/api/guest/session", { method: "POST" });
  },

  async setSessionStatus(
    sessionId: string,
    status: GuestSession["status"],
    settlementMethod?: SettlementMethod,
  ): Promise<GuestSession | null> {
    return api<GuestSession>(`/api/sessions/${encodeURIComponent(sessionId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status, settlementMethod }),
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

  // TODO(backend): plan 16 graduation — SessionTransferred/SessionsMerged domain
  // events (AD-6) so the host's session sheet updates live on the other device.
  async transferSession(
    sessionId: string,
    toTableId: string,
    toTableCode: string,
    toZoneName: string,
    staffId: string,
    staffName: string,
  ): Promise<GuestSession | null> {
    return api<GuestSession>(`/api/tab/sessions/${encodeURIComponent(sessionId)}/transfer`, {
      method: "PATCH",
      body: JSON.stringify({ toTableId, toTableCode, toZoneName, staffId, staffName }),
    });
  },

  async mergeSession(
    childSessionId: string,
    parentSessionId: string,
    staffId: string,
    staffName: string,
  ): Promise<GuestSession | null> {
    return api<GuestSession>(`/api/tab/sessions/${encodeURIComponent(childSessionId)}/merge`, {
      method: "PATCH",
      body: JSON.stringify({ parentSessionId, staffId, staffName }),
    });
  },

  // TODO(backend): plan 17 graduation — no route exists yet for refusing
  // service on a session; responsible-service controls stay demo-track only.
  async refuseService(): Promise<GuestSession | null> {
    throw new Error("Not yet supported in the live build");
  },
};
import { liveFetch } from "./live-fetch";
