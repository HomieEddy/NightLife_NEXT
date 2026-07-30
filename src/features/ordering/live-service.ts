"use client";

import type { AdjustmentReason, GuestSession, MenuItem, Order, OrderRemake, OrderStatus, TabAdjustment, TabAdjustmentKind, WalkoutRecord } from "@/lib/types";
import type { CartLine } from "@/lib/types";
import { toCents } from "@/features/shared/money";

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

export const liveOrdersService = {
  async listOrders(filter?: { status?: OrderStatus[]; zoneIds?: string[] }): Promise<Order[]> {
    const params = new URLSearchParams();
    for (const s of filter?.status ?? []) params.append("status", s);
    for (const z of filter?.zoneIds ?? []) params.append("zoneId", z);
    const qs = params.toString();
    return api<Order[]>(`/api/orders${qs ? `?${qs}` : ""}`);
  },

  async getOrder(orderId: string): Promise<Order | null> {
    const res = await liveFetch(`/api/orders/${encodeURIComponent(orderId)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to get order ${orderId}`);
    return res.json();
  },

  async listGuestOrders(guestName: string): Promise<Order[]> {
    return api<Order[]>(`/api/orders?guestName=${encodeURIComponent(guestName)}`);
  },

  async submitOrder(input: {
    tableId: string;
    tableCode: string;
    zoneId: string;
    zoneName: string;
    guestName: string;
    sessionId?: string;
    lines: CartLine[];
    tip: number;
    promoCode?: string;
  }): Promise<Order> {
    return api<Order>("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        tableId: input.tableId,
        tableCode: input.tableCode,
        zoneId: input.zoneId,
        zoneName: input.zoneName,
        guestName: input.guestName,
        sessionId: input.sessionId,
        lines: input.lines.map((l) => ({
          menuItemId: l.menuItem.id,
          quantity: l.quantity,
          modifiers: l.modifiers.map((m) => ({
            groupId: m.groupId,
            optionId: m.optionId,
            quantity: m.quantity,
          })),
          note: l.note,
        })),
        tipCents: toCents(input.tip),
        promoCode: input.promoCode,
      }),
    });
  },

  async sendGift(input: {
    fromTableId: string;
    fromTableCode: string;
    fromZoneId: string;
    fromZoneName: string;
    guestName: string;
    sessionId?: string;
    items: { menuItem: MenuItem; quantity: number }[];
    toTableId: string;
    toTableCode: string;
    note?: string;
  }): Promise<Order> {
    return api<Order>("/api/orders/gift", {
      method: "POST",
      body: JSON.stringify({
        fromTableId: input.fromTableId,
        fromTableCode: input.fromTableCode,
        fromZoneId: input.fromZoneId,
        fromZoneName: input.fromZoneName,
        guestName: input.guestName,
        sessionId: input.sessionId,
        items: input.items.map((l) => ({ menuItemId: l.menuItem.id, quantity: l.quantity })),
        toTableId: input.toTableId,
        toTableCode: input.toTableCode,
        note: input.note,
      }),
    });
  },

  async listOrdersBySession(sessionId: string): Promise<Order[]> {
    return api<Order[]>(`/api/orders?sessionId=${encodeURIComponent(sessionId)}`);
  },

  async advanceOrder(orderId: string): Promise<Order | null> {
    return api<Order>(`/api/orders/${encodeURIComponent(orderId)}/advance`, { method: "PATCH" });
  },

  async claimOrder(orderId: string, staffId: string, staffName: string): Promise<Order | null> {
    const res = await liveFetch(`/api/orders/${encodeURIComponent(orderId)}/claim`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId, staffName }),
    });
    if (res.status === 409) return null;
    if (!res.ok) throw new Error(`Failed to claim order ${orderId}`);
    return res.json();
  },

  async releaseOrder(orderId: string): Promise<Order | null> {
    return api<Order>(`/api/orders/${encodeURIComponent(orderId)}/release`, { method: "PATCH" });
  },

  async cancelOrder(orderId: string): Promise<Order | null> {
    return api<Order>(`/api/orders/${encodeURIComponent(orderId)}/cancel`, { method: "PATCH" });
  },

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

  async reassignOrdersToSession(fromSessionId: string, toSessionId: string): Promise<void> {
    await api(`/api/tab/sessions/${encodeURIComponent(fromSessionId)}/reassign`, {
      method: "PATCH",
      body: JSON.stringify({ toSessionId }),
    });
  },

  async reopenSession(sessionId: string): Promise<GuestSession | null> {
    return api(`/api/sessions/${encodeURIComponent(sessionId)}/reopen`, { method: "POST" });
  },

  async getSessionRoundCount(_sessionId: string): Promise<number> {
    return api("/api/sessions/round-count");
  },

  async detectDualSession(_tableId: string): Promise<GuestSession[]> {
    return api("/api/sessions/dual");
  },

  async checkInventoryAvailability(_cartLines: { menuItemId: string; quantity: number }[]): Promise<{ menuItemId: string; name: string; available: number; requested: number }[]> {
    return api("/api/inventory/availability", { method: "POST" });
  },

  async rushOrder(orderId: string, staffName: string): Promise<Order | null> {
    return api<Order>(`/api/orders/${encodeURIComponent(orderId)}/rush`, {
      method: "PATCH",
      body: JSON.stringify({ staffName }),
    });
  },

  async compEntireOrder(orderId: string, reasonCode: string, staffId: string, staffName: string): Promise<TabAdjustment> {
    return api<TabAdjustment>(`/api/orders/${encodeURIComponent(orderId)}/comp`, {
      method: "PATCH",
      body: JSON.stringify({ reasonCode, staffId, staffName }),
    });
  },

  async remakeOrder(oldOrderId: string, newOrderId: string, reason: string, staffId: string, staffName: string): Promise<OrderRemake> {
    return api<OrderRemake>(`/api/orders/${encodeURIComponent(oldOrderId)}/remake`, {
      method: "PATCH",
      body: JSON.stringify({ newOrderId, reason, staffId, staffName }),
    });
  },

  async reportWalkout(sessionId: string, description: string, staffId: string, staffName: string): Promise<WalkoutRecord> {
    return api<WalkoutRecord>(`/api/tab/sessions/${encodeURIComponent(sessionId)}/walkout`, {
      method: "POST",
      body: JSON.stringify({ description, staffId, staffName }),
    });
  },
};
import { liveFetch } from "@/features/shared/live-fetch";
