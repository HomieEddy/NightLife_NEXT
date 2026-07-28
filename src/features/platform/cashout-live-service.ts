"use client";

import type { GuestSession, Order, SettlementMethod, ShiftCashout, TabAdjustment } from "@/lib/types";
import { computeCashoutExpected } from "@/lib/tab";

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

// TODO(backend): plan 16 graduation — /api/cashout route handlers; expected
// totals computed server-side from the session ledger, not client-derived.
export const liveCashoutService = {
  async listCashouts(staffId?: string): Promise<ShiftCashout[]> {
    const qs = staffId ? `?staffId=${encodeURIComponent(staffId)}` : "";
    return api<ShiftCashout[]>(`/api/cashout${qs}`);
  },

  async previewExpected(
    businessDate: string,
    nightEndHour: number,
    sessions: GuestSession[],
    orders: Order[],
    adjustments: TabAdjustment[],
    staffId?: string,
  ): Promise<Record<SettlementMethod, number>> {
    void staffId;
    // Client-side preview only — the authoritative figure is recomputed server-side on close.
    return computeCashoutExpected(sessions, orders, adjustments, businessDate, nightEndHour);
  },

  async closeCashout(input: {
    staffId?: string;
    businessDate: string;
    expectedByMethod: Record<SettlementMethod, number>;
    countedByMethod: Record<SettlementMethod, number>;
    note?: string;
    closedByStaffId: string;
    closedByStaffName: string;
  }): Promise<ShiftCashout> {
    return api<ShiftCashout>("/api/cashout", { method: "POST", body: JSON.stringify(input) });
  },
};

import { liveFetch } from "@/features/shared/live-fetch";
