"use client";

import type {
  AdjustmentReason,
  GuestSession,
  TabAdjustment,
  TabAdjustmentKind,
  WalkoutRecord,
} from "@/lib/types";
import { api } from "@/features/ordering/live-api";

/** Live adapter for the TAB / SESSION-OPERATIONS domain — `/api/tab/*` and `/api/sessions/*` fetches. */
export const liveTabService = {
  async listAdjustmentReasons(kind?: TabAdjustmentKind): Promise<AdjustmentReason[]> {
    const qs = kind ? `?kind=${encodeURIComponent(kind)}` : "";
    return api<AdjustmentReason[]>(`/api/tab/reasons${qs}`);
  },

  async listAllAdjustmentReasons(): Promise<AdjustmentReason[]> {
    return api<AdjustmentReason[]>("/api/tab/reasons?all=1");
  },

  async createAdjustmentReason(input: Omit<AdjustmentReason, "id" | "venueId">): Promise<AdjustmentReason> {
    return api<AdjustmentReason>("/api/tab/reasons", { method: "POST", body: JSON.stringify(input) });
  },

  async setAdjustmentReasonActive(reasonId: string, isActive: boolean): Promise<AdjustmentReason | null> {
    return api<AdjustmentReason>(`/api/tab/reasons/${encodeURIComponent(reasonId)}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    });
  },

  async listAdjustments(sessionId: string): Promise<TabAdjustment[]> {
    return api<TabAdjustment[]>(`/api/tab/adjustments?sessionId=${encodeURIComponent(sessionId)}`);
  },

  async listAllAdjustments(): Promise<TabAdjustment[]> {
    return api<TabAdjustment[]>("/api/tab/adjustments");
  },

  async adjustOrder(input: {
    orderId: string;
    orderItemId?: string;
    quantity?: number;
    kind: TabAdjustmentKind;
    reasonCode: string;
    note?: string;
    authorStaffId: string;
    authorStaffName: string;
  }): Promise<TabAdjustment> {
    return api<TabAdjustment>("/api/tab/adjustments", { method: "POST", body: JSON.stringify(input) });
  },

  async reverseAdjustment(adjustmentId: string, staffId: string, staffName: string): Promise<TabAdjustment | null> {
    return api<TabAdjustment>(`/api/tab/adjustments/${encodeURIComponent(adjustmentId)}/reverse`, {
      method: "PATCH",
      body: JSON.stringify({ staffId, staffName }),
    });
  },

  async compEntireOrder(orderId: string, reasonCode: string, staffId: string, staffName: string): Promise<TabAdjustment> {
    return api<TabAdjustment>(`/api/orders/${encodeURIComponent(orderId)}/comp`, {
      method: "PATCH",
      body: JSON.stringify({ reasonCode, staffId, staffName }),
    });
  },

  async reassignOrdersToSession(fromSessionId: string, toSessionId: string): Promise<void> {
    await api(`/api/tab/sessions/${encodeURIComponent(fromSessionId)}/reassign`, {
      method: "PATCH",
      body: JSON.stringify({ toSessionId }),
    });
  },

  async reopenSession(sessionId: string): Promise<GuestSession | null> {
    return api(`/api/sessions/${encodeURIComponent(sessionId)}/reopen`, { method: "POST" });
  },

  async reportWalkout(sessionId: string, description: string, staffId: string, staffName: string): Promise<WalkoutRecord> {
    return api<WalkoutRecord>(`/api/tab/sessions/${encodeURIComponent(sessionId)}/walkout`, {
      method: "POST",
      body: JSON.stringify({ description, staffId, staffName }),
    });
  },
};
