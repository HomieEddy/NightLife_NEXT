"use client";

import type { MenuItem, Order, OrderStatus } from "@/lib/types";
import type { CartLine } from "@/lib/types";
import { toCents } from "@/server/money";

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
    menuItem: MenuItem;
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
        menuItemId: input.menuItem.id,
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
};
import { liveFetch } from "./live-fetch";
