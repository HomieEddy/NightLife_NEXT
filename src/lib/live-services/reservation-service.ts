"use client";

import type { Reservation, ReservationStatus } from "@/lib/types";

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

export const liveReservationService = {
  async listReservations(filter?: {
    status?: ReservationStatus[];
    zoneIds?: string[];
    date?: string;
  }): Promise<Reservation[]> {
    const params = new URLSearchParams();
    for (const s of filter?.status ?? []) params.append("status", s);
    for (const z of filter?.zoneIds ?? []) params.append("zoneId", z);
    if (filter?.date) params.set("date", filter.date);
    const qs = params.toString();
    return api<Reservation[]>(`/api/reservations${qs ? `?${qs}` : ""}`);
  },

  async getReservation(id: string): Promise<Reservation | null> {
    const res = await fetch(`/api/reservations/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to get reservation ${id}`);
    return res.json();
  },

  async createReservation(input: {
    tableId?: string;
    zoneId?: string;
    guestName: string;
    partySize: number;
    startsAt: string;
    endsAt?: string;
    note?: string;
    source: "manager" | "public";
  }): Promise<Reservation> {
    return api<Reservation>("/api/reservations", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async updateReservation(
    id: string,
    patch: Partial<Omit<Reservation, "id" | "venueId" | "createdAt">>,
  ): Promise<Reservation | null> {
    return api<Reservation>(`/api/reservations/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  async setStatus(id: string, status: ReservationStatus): Promise<Reservation | null> {
    return api<Reservation>(`/api/reservations/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },

  async cancelReservation(id: string): Promise<Reservation | null> {
    return this.setStatus(id, "cancelled");
  },
};
