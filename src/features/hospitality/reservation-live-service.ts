"use client";

import type { Reservation, ReservationChannel, ReservationStatus } from "@/lib/types";
import type { PublicAvailability } from "@/features/hospitality/reservation-mock-service";

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

  // TODO(backend): add promoterId filter to reservation list query
  async listMyReservations(promoterId: string): Promise<Reservation[]> {
    const params = new URLSearchParams({ promoterId });
    return api<Reservation[]>(`/api/reservations?${params}`);
  },

  async getReservation(id: string): Promise<Reservation | null> {
    const res = await liveFetch(`/api/reservations/${encodeURIComponent(id)}`);
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
    channel?: ReservationChannel;
    guestEmail?: string;
    guestPhone?: string;
    eventId?: string;
    promoterId?: string;
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

  // TODO(backend): plan 17 graduation — the route handler rejects "no-show"
  // today (see setReservationStatus in src/server/reservation-core.ts); wire
  // it through once the Prisma enum gains the value.
  async markNoShow(id: string): Promise<Reservation | null> {
    return this.setStatus(id, "no-show");
  },

  // TODO(backend): implement public reservation API routes (plan 13)
  async getPublicAvailability(
    venueSlug: string,
    opts: { date: string; eventId?: string },
  ): Promise<PublicAvailability | null> {
    const params = new URLSearchParams({ date: opts.date });
    if (opts.eventId) params.set("eventId", opts.eventId);
    return api<PublicAvailability>(`/api/public/reservations/${encodeURIComponent(venueSlug)}/availability?${params}`);
  },

  async createPublicReservation(input: {
    venueSlug: string;
    tableId: string;
    zoneId: string;
    guestName: string;
    partySize: number;
    date: string;
    guestEmail?: string;
    guestPhone?: string;
    note?: string;
    eventId?: string;
  }): Promise<Reservation> {
    return api<Reservation>(`/api/public/reservations/${encodeURIComponent(input.venueSlug)}`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async getActiveReservationForTable(tableId: string): Promise<Reservation | null> {
    const res = await liveFetch(`/api/public/reservations/table/${encodeURIComponent(tableId)}/active`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("Failed to check table reservation");
    return res.json();
  },

  async validatePinAndSeat(
    tableId: string,
    pin: string,
  ): Promise<{ ok: boolean; error?: string }> {
    return api<{ ok: boolean; error?: string }>(`/api/public/reservations/table/${encodeURIComponent(tableId)}/pin`, {
      method: "POST",
      body: JSON.stringify({ pin }),
    });
  },

  async checkCapacityForBooking(_date: string, _partySize: number): Promise<{ allowed: boolean; currentBooked: number; legalCapacity: number }> {
    return api("/api/reservations/capacity-check", { method: "POST" });
  },
};
import { liveFetch } from "@/features/shared/live-fetch";
