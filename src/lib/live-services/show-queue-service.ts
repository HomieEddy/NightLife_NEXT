"use client";

import type { ActiveShow, Order } from "@/lib/types";
import { orderNeedsShow, showLabelFor } from "@/lib/order-presentation";

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

export const liveShowQueueService = {
  async getActiveShow(): Promise<ActiveShow | null> {
    return api<ActiveShow | null>("/api/floor/show");
  },

  async startShow(order: Order, staffName: string): Promise<{ ok: boolean; activeShow: ActiveShow | null }> {
    return api<{ ok: boolean; activeShow: ActiveShow | null }>("/api/floor/show", {
      method: "POST",
      body: JSON.stringify({
        action: "start",
        orderId: order.id,
        tableCode: order.tableCode,
        zoneName: order.zoneName,
        label: showLabelFor(order),
        staffName,
      }),
    });
  },

  async finishShow(): Promise<void> {
    await api("/api/floor/show", {
      method: "POST",
      body: JSON.stringify({ action: "finish" }),
    });
  },
};

export { orderNeedsShow, showLabelFor };
import { liveFetch } from "./live-fetch";
