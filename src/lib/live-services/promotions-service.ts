"use client";

import type { Promotion } from "@/lib/types";

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

export const livePromotionsService = {
  async listPromotions(): Promise<Promotion[]> {
    return api<Promotion[]>("/api/promotions");
  },

  async getPromotion(id: string): Promise<Promotion | null> {
    const res = await fetch(`/api/promotions/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to get promotion ${id}`);
    return res.json();
  },

  async createPromotion(input: Omit<Promotion, "id" | "venueId" | "redemptionCount">): Promise<Promotion> {
    return api<Promotion>("/api/promotions", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async updatePromotion(
    id: string,
    patch: Partial<Omit<Promotion, "id" | "venueId" | "redemptionCount">>,
  ): Promise<Promotion | null> {
    return api<Promotion>(`/api/promotions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  async deletePromotion(id: string): Promise<void> {
    await api<{ ok: boolean }>(`/api/promotions/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  async validateCode(code: string): Promise<Promotion | null> {
    const res = await api<{ valid: boolean; promotion?: Promotion }>("/api/promotions/validate", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    return res.valid && res.promotion ? res.promotion : null;
  },
};
