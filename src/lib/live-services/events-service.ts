"use client";

import type { VenueEvent, EventGuest, EventTalent } from "@/lib/types";

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
    guestProfileId?: string;
  }): Promise<EventGuest> {
    return api<EventGuest>(`/api/events/${encodeURIComponent(input.eventId)}/guests`, {
      method: "POST",
      body: JSON.stringify({ name: input.name, partySize: input.partySize, guestProfileId: input.guestProfileId }),
    });
  },

  async removeEventGuest(guestId: string): Promise<void> {
    await api<{ ok: boolean }>(`/api/event-guests/${encodeURIComponent(guestId)}`, { method: "DELETE" });
  },

  // TODO(backend): plan 17 graduation — no PATCH route exists yet for
  // event-guest status (only POST/DELETE); door check-in stays demo-track
  // only until that route ships.
  async setEventGuestStatus(): Promise<EventGuest | null> {
    throw new Error("Not yet supported in the live build");
  },

  async listPublicEvents(
    venueSlug: string,
  ): Promise<{ venueName: string; events: VenueEvent[] } | null> {
    const res = await liveFetch(`/api/public/events/${encodeURIComponent(venueSlug)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to load public events`);
    return res.json();
  },

  // TODO(backend): event cancellation API route
  async cancelEvent(id: string, reason: string): Promise<VenueEvent | null> {
    return api<VenueEvent>(`/api/events/${encodeURIComponent(id)}/cancel`, { method: "POST", body: JSON.stringify({ reason }) });
  },

  // TODO(backend): talent management API routes
  async listEventTalent(eventId: string): Promise<EventTalent[]> {
    return api<EventTalent[]>(`/api/events/${encodeURIComponent(eventId)}/talent`);
  },
  async getTalent(id: string): Promise<EventTalent | null> {
    const res = await liveFetch(`/api/event-talent/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to get talent ${id}`);
    return res.json();
  },
  async createTalent(input: Omit<EventTalent, "id" | "venueId" | "createdAt">): Promise<EventTalent> {
    return api<EventTalent>(`/api/events/${encodeURIComponent(input.eventId)}/talent`, { method: "POST", body: JSON.stringify(input) });
  },
  async updateTalent(id: string, patch: Partial<Omit<EventTalent, "id" | "venueId" | "eventId" | "createdAt">>): Promise<EventTalent | null> {
    return api<EventTalent>(`/api/event-talent/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
  },
  async deleteTalent(id: string): Promise<void> {
    await api<{ ok: boolean }>(`/api/event-talent/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
  async markTalentArrived(id: string): Promise<EventTalent | null> {
    return api<EventTalent>(`/api/event-talent/${encodeURIComponent(id)}/arrived`, { method: "POST" });
  },
  async markTalentPerforming(id: string): Promise<EventTalent | null> {
    return api<EventTalent>(`/api/event-talent/${encodeURIComponent(id)}/performing`, { method: "POST" });
  },
  async markTalentCompleted(id: string): Promise<EventTalent | null> {
    return api<EventTalent>(`/api/event-talent/${encodeURIComponent(id)}/completed`, { method: "POST" });
  },
};
import { liveFetch } from "./live-fetch";
