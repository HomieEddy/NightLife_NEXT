"use client";

import type { mockTimeService } from "@/features/workforce/time-mock-service";
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

export const liveTimeService: typeof mockTimeService = {
  async listEntries(staffId) {
    const qs = staffId ? `?staffId=${encodeURIComponent(staffId)}` : "";
    return api(`/api/workforce/time/entries${qs}`);
  },

  async clockIn(staffId, shiftId) {
    return api("/api/workforce/time/clock-in", {
      method: "POST",
      body: JSON.stringify({ staffId, shiftId }),
    });
  },

  async clockOut(staffId) {
    return api("/api/workforce/time/clock-out", {
      method: "POST",
      body: JSON.stringify({ staffId }),
    });
  },

  async startBreak(staffId) {
    return api("/api/workforce/time/break-start", {
      method: "POST",
      body: JSON.stringify({ staffId }),
    });
  },

  async endBreak(staffId) {
    return api("/api/workforce/time/break-end", {
      method: "POST",
      body: JSON.stringify({ staffId }),
    });
  },

  async getCurrentEntry(staffId) {
    return api(`/api/workforce/time/current?staffId=${encodeURIComponent(staffId)}`);
  },

  async editEntry(entryId, edits, editorId, reason) {
    return api("/api/workforce/time/edit", {
      method: "POST",
      body: JSON.stringify({ entryId, ...edits, editorId, reason }),
    });
  },

  async listShifts(staffId) {
    const qs = staffId ? `?staffId=${encodeURIComponent(staffId)}` : "";
    return api(`/api/workforce/time/shifts${qs}`);
  },

  async publishShifts(shifts) {
    return api("/api/workforce/time/shifts/publish", {
      method: "POST",
      body: JSON.stringify({ shiftIds: shifts.map((s) => s.id) }),
    });
  },

  async listTimeOffRequests(staffId) {
    const qs = staffId ? `?staffId=${encodeURIComponent(staffId)}` : "";
    return api(`/api/workforce/time/off${qs}`);
  },

  async requestTimeOff(req) {
    return api("/api/workforce/time/off", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  async approveTimeOff(requestId, deciderId, approved) {
    return api(`/api/workforce/time/off/${encodeURIComponent(requestId)}`, {
      method: "PATCH",
      body: JSON.stringify({ approved, deciderId }),
    });
  },

  async listSwapRequests() {
    return api("/api/workforce/time/swaps");
  },

  async requestSwap(req) {
    return api("/api/workforce/time/swaps", {
      method: "POST",
      body: JSON.stringify(req),
    });
  },

  async approveSwap(requestId, deciderId, approved) {
    return api(`/api/workforce/time/swaps/${encodeURIComponent(requestId)}/approve`, {
      method: "PATCH",
      body: JSON.stringify({ approved, deciderId }),
    });
  },

  async claimSwap(requestId, staffId) {
    return api(`/api/workforce/time/swaps/${encodeURIComponent(requestId)}/claim`, {
      method: "PATCH",
      body: JSON.stringify({ staffId }),
    });
  },
};
