/**
 * mockEventsService — future backend boundary for events and guestlists.
 * The permanent demo counterpart to the PostgreSQL-backed live service.
 */
import type { VenueEvent, EventGuest, EventTalent, TalentStatus } from "@/lib/types";
import { mockEvents, mockEventGuests } from "@/lib/mock-data/events";
import { mockEventTalent } from "@/lib/mock-data/event-talent";
import { mockVenue } from "@/lib/mock-data/venue";
import { clone, delay, uid } from "./delay";

let events: VenueEvent[] = clone(mockEvents);
let guests: EventGuest[] = clone(mockEventGuests);
let talent: EventTalent[] = clone(mockEventTalent);

function sortByDate(list: VenueEvent[]): VenueEvent[] {
  return [...list].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export const mockEventsService = {
  async listEvents(): Promise<VenueEvent[]> {
    await delay();
    return sortByDate(clone(events));
  },

  async getEvent(id: string): Promise<VenueEvent | null> {
    await delay(200);
    return clone(events.find((e) => e.id === id) ?? null);
  },

  async createEvent(input: Omit<VenueEvent, "id" | "venueId">): Promise<VenueEvent> {
    await delay(500);
    const event: VenueEvent = { id: uid("evt"), venueId: mockVenue.id, ...input };
    events = [event, ...events];
    return clone(event);
  },

  async updateEvent(
    id: string,
    patch: Partial<Omit<VenueEvent, "id" | "venueId">>,
  ): Promise<VenueEvent | null> {
    await delay(400);
    const event = events.find((e) => e.id === id);
    if (!event) return null;
    Object.assign(event, patch);
    return clone(event);
  },

  async deleteEvent(id: string): Promise<void> {
    await delay(400);
    events = events.filter((e) => e.id !== id);
    guests = guests.filter((g) => g.eventId !== id);
  },

  async listEventGuests(eventId: string): Promise<EventGuest[]> {
    await delay(200);
    return clone(guests.filter((g) => g.eventId === eventId));
  },

  async addEventGuest(input: {
    eventId: string;
    name: string;
    partySize: number;
    /** Set when the door/host resolves a repeat guestlist name to a known regular (plan 17). */
    guestProfileId?: string;
  }): Promise<EventGuest> {
    await delay(300);
    const guest: EventGuest = {
      id: uid("eg"),
      eventId: input.eventId,
      name: input.name.trim(),
      partySize: input.partySize,
      status: "invited",
      guestProfileId: input.guestProfileId,
    };
    guests = [...guests, guest];
    return clone(guest);
  },

  async removeEventGuest(guestId: string): Promise<void> {
    await delay(200);
    guests = guests.filter((g) => g.id !== guestId);
  },

  async setEventGuestStatus(guestId: string, status: EventGuest["status"]): Promise<EventGuest | null> {
    await delay(250);
    const guest = guests.find((g) => g.id === guestId);
    if (!guest) return null;
    guest.status = status;
    return clone(guest);
  },

  // TODO(backend): query by venue slug + status IN ('published','live') + startsAt >= now
  async listPublicEvents(
    venueSlug: string,
  ): Promise<{ venueName: string; events: VenueEvent[] } | null> {
    await delay();
    if (venueSlug !== mockVenue.publicSlug) return null;
    const visible = events.filter(
      (e) => e.status === "published" || e.status === "live",
    );
    return { venueName: mockVenue.name, events: sortByDate(clone(visible)) };
  },

  // ── EV-03: Event cancellation ─────────────────────────────────

  async cancelEvent(id: string, reason: string): Promise<VenueEvent | null> {
    await delay(300);
    const event = events.find((e) => e.id === id);
    if (!event) return null;
    event.status = "cancelled";
    event.cancellationReason = reason.trim();
    event.cancelledAt = new Date().toISOString();
    return clone(event);
  },

  // ── EV-01: Artist/talent management ───────────────────────────

  async listEventTalent(eventId: string): Promise<EventTalent[]> {
    await delay(200);
    return clone(talent.filter((t) => t.eventId === eventId));
  },

  async getTalent(id: string): Promise<EventTalent | null> {
    await delay(150);
    return clone(talent.find((t) => t.id === id) ?? null);
  },

  async createTalent(input: Omit<EventTalent, "id" | "venueId" | "createdAt">): Promise<EventTalent> {
    await delay(400);
    const entry: EventTalent = {
      id: uid("tal"),
      venueId: mockVenue.id,
      ...input,
      createdAt: new Date().toISOString(),
    };
    talent = [entry, ...talent];
    return clone(entry);
  },

  async updateTalent(id: string, patch: Partial<Omit<EventTalent, "id" | "venueId" | "eventId" | "createdAt">>): Promise<EventTalent | null> {
    await delay(300);
    const entry = talent.find((t) => t.id === id);
    if (!entry) return null;
    Object.assign(entry, patch);
    return clone(entry);
  },

  async deleteTalent(id: string): Promise<void> {
    await delay(200);
    talent = talent.filter((t) => t.id !== id);
  },

  async markTalentArrived(id: string): Promise<EventTalent | null> {
    return this.updateTalent(id, { status: "arrived" });
  },

  async markTalentPerforming(id: string): Promise<EventTalent | null> {
    return this.updateTalent(id, { status: "performing" });
  },

  async markTalentCompleted(id: string): Promise<EventTalent | null> {
    return this.updateTalent(id, { status: "completed" });
  },
};
