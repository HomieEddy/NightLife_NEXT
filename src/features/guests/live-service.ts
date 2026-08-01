"use client";

import type { BarTab, GuestSession, HelpRequest, HelpRequestType, SettlementMethod, SplitBillAssignment } from "@/lib/types";
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
    const res = await liveFetch("/api/guest/session");
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

  async splitBill(sessionId: string, splits: { label: string; orderItemIds: string[] }[]): Promise<SplitBillAssignment | null> {
    return api<SplitBillAssignment>(`/api/tab/sessions/${encodeURIComponent(sessionId)}/split`, {
      method: "POST",
      body: JSON.stringify({ splits }),
    });
  },

  async markLastCallOrderPlaced(sessionId: string): Promise<void> {
    await api(`/api/sessions/${encodeURIComponent(sessionId)}/last-call-order`, { method: "POST" });
  },

  // ---------- WS-2 graduated methods ----------

  async refuseService(sessionId: string, reason: string, staffId: string, staffName: string): Promise<GuestSession | null> {
    return api<GuestSession>(`/api/sessions/${encodeURIComponent(sessionId)}/refuse-service`, {
      method: "POST",
      body: JSON.stringify({ reason, staffId, staffName }),
    });
  },

  async ejectGuest(sessionId: string, reason: string, staffId: string, staffName: string): Promise<void> {
    await api(`/api/sessions/${encodeURIComponent(sessionId)}/eject`, {
      method: "POST",
      body: JSON.stringify({ reason, staffId, staffName }),
    });
  },

  // ---------- WS-2: Bar tabs ----------

  async createBarTab(input: {
    guestName: string;
    guestProfileId?: string;
    staffId: string;
    staffName: string;
  }): Promise<BarTab> {
    return api<BarTab>("/api/bar-tabs", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async closeBarTab(barTabId: string): Promise<BarTab> {
    return api<BarTab>(`/api/bar-tabs/${encodeURIComponent(barTabId)}/close`, {
      method: "POST",
    });
  },

  async listBarTabs(): Promise<BarTab[]> {
    return api<BarTab[]>("/api/bar-tabs");
  },

  // ---------- WS-2: Host assignment ----------

  async assignHost(
    sessionId: string,
    hostId: string,
    hostName: string,
  ): Promise<GuestSession | null> {
    return api<GuestSession>(`/api/sessions/${encodeURIComponent(sessionId)}/host`, {
      method: "POST",
      body: JSON.stringify({ hostStaffId: hostId, hostStaffName: hostName }),
    });
  },

  async unassignHost(sessionId: string): Promise<GuestSession | null> {
    return api<GuestSession>(`/api/sessions/${encodeURIComponent(sessionId)}/host`, {
      method: "DELETE",
    });
  },

  async listSessionsByHost(hostId: string): Promise<GuestSession[]> {
    return api<GuestSession[]>(`/api/sessions?hostStaffId=${encodeURIComponent(hostId)}`);
  },

  // ---------- WS-2: Spend analytics ----------

  async getGuestSpendTonight(profileId: string): Promise<{ totalSpent: number; orderCount: number; sessionCount: number }> {
    return api(`/api/guests/spend?profileId=${encodeURIComponent(profileId)}`);
  },

  async getTopSpendersTonight(limit = 10): Promise<{ profileId: string; displayName: string; totalSpent: number; orderCount: number; tier: import("@/lib/types").GuestVipTier }[]> {
    return api(`/api/guests/spend?top=${limit}`);
  },

  // ---------- WS-2: VIP tier benefits ----------

  async listVipTierBenefits(tier?: import("@/lib/types").GuestVipTier): Promise<import("@/lib/types").VipTierBenefit[]> {
    const qs = tier ? `?tier=${encodeURIComponent(tier)}` : "";
    return api<import("@/lib/types").VipTierBenefit[]>(`/api/guests/vip-tiers${qs}`);
  },

  async createVipTierBenefit(input: Omit<import("@/lib/types").VipTierBenefit, "id" | "venueId">): Promise<import("@/lib/types").VipTierBenefit> {
    return api<import("@/lib/types").VipTierBenefit>("/api/guests/vip-tiers", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async updateVipTierBenefit(
    id: string,
    patch: Partial<Pick<import("@/lib/types").VipTierBenefit, "benefit" | "category" | "sortOrder" | "active">>,
  ): Promise<import("@/lib/types").VipTierBenefit | null> {
    const res = await liveFetch(`/api/guests/vip-tiers/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to update VIP tier benefit ${id}`);
    return res.json();
  },

  async removeVipTierBenefit(id: string): Promise<void> {
    await api(`/api/guests/vip-tiers/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  // ---------- WS-2: Abandoned session detection ----------

  async detectAbandonedSessions(thresholdMinutes = 60): Promise<GuestSession[]> {
    return api<GuestSession[]>(`/api/sessions?status=approved&inactiveMinutes=${thresholdMinutes}`);
  },

  async autoCloseSession(sessionId: string): Promise<GuestSession | null> {
    return api<GuestSession>(`/api/sessions/${encodeURIComponent(sessionId)}/force-close`, {
      method: "POST",
    });
  },

  // ---------- WS-2: Session notes ----------

  async addSessionNote(
    sessionId: string,
    note: string,
    staffId: string,
    staffName: string,
  ): Promise<import("@/lib/types").SessionNote> {
    return api<import("@/lib/types").SessionNote>(`/api/sessions/${encodeURIComponent(sessionId)}/notes`, {
      method: "POST",
      body: JSON.stringify({ note, staffId, staffName }),
    });
  },

  async listSessionNotes(sessionId: string): Promise<import("@/lib/types").SessionNote[]> {
    return api<import("@/lib/types").SessionNote[]>(
      `/api/sessions/${encodeURIComponent(sessionId)}/notes`,
    );
  },

  async forceCloseSession(sessionId: string, reason: string, staffId: string, staffName: string): Promise<GuestSession | null> {
    return api<GuestSession>(`/api/sessions/${encodeURIComponent(sessionId)}/force-close`, {
      method: "POST",
      body: JSON.stringify({ reason, staffId, staffName }),
    });
  },
};
