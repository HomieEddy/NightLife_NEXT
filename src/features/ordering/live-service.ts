"use client";

import type { CartLine, MenuItem, Order, OrderRemake, OrderStatus } from "@/lib/types";
import { toCents } from "@/features/shared/money";
import { api } from "@/features/ordering/live-api";
import { liveFetch } from "@/features/shared/live-fetch";

/** Live adapter for the ORDER domain — every call is an `/api/orders/*` fetch. */
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

  async rushOrder(orderId: string, staffName: string): Promise<Order | null> {
    return api<Order>(`/api/orders/${encodeURIComponent(orderId)}/rush`, {
      method: "PATCH",
      body: JSON.stringify({ staffName }),
    });
  },

  async remakeOrder(oldOrderId: string, newOrderId: string, reason: string, staffId: string, staffName: string): Promise<OrderRemake> {
    return api<OrderRemake>(`/api/orders/${encodeURIComponent(oldOrderId)}/remake`, {
      method: "PATCH",
      body: JSON.stringify({ newOrderId, reason, staffId, staffName }),
    });
  },
};
