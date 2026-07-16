"use client";

import type { VenueEvent, EventGuest } from "@/lib/types";

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

export const liveEventsService = {
  async listEvents(): Promise<VenueEvent[]> {
    return api<VenueEvent[]>("/api/events");
  },

  async getEvent(id: string): Promise<VenueEvent | null> {
    const res = await liveFetch(`/api/events/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to get event ${id}`);
    return res.json();
  },

  async createEvent(input: Omit<VenueEvent, "id" | "venueId">): Promise<VenueEvent> {
    return api<VenueEvent>("/api/events", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async updateEvent(
    id: string,
    patch: Partial<Omit<VenueEvent, "id" | "venueId">>,
  ): Promise<VenueEvent | null> {
    return api<VenueEvent>(`/api/events/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  async deleteEvent(id: string): Promise<void> {
    await api<{ ok: boolean }>(`/api/events/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  async listEventGuests(eventId: string): Promise<EventGuest[]> {
    return api<EventGuest[]>(`/api/events/${encodeURIComponent(eventId)}/guests`);
  },

  async addEventGuest(input: {
    eventId: string;
    name: string;
    partySize: number;
  }): Promise<EventGuest> {
    return api<EventGuest>(`/api/events/${encodeURIComponent(input.eventId)}/guests`, {
      method: "POST",
      body: JSON.stringify({ name: input.name, partySize: input.partySize }),
    });
  },

  async removeEventGuest(guestId: string): Promise<void> {
    await api<{ ok: boolean }>(`/api/event-guests/${encodeURIComponent(guestId)}`, { method: "DELETE" });
  },
};
import { liveFetch } from "./live-fetch";
