/**
 * mockEventsService — future backend boundary for events and guestlists.
 * TODO(backend): replace with API routes backed by PostgreSQL.
 */
import type { VenueEvent, EventGuest } from "@/lib/types";
import { mockEvents, mockEventGuests } from "@/lib/mock-data/events";
import { mockVenue } from "@/lib/mock-data/venue";
import { clone, delay, uid } from "./delay";

let events: VenueEvent[] = clone(mockEvents);
let guests: EventGuest[] = clone(mockEventGuests);

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
  }): Promise<EventGuest> {
    await delay(300);
    const guest: EventGuest = {
      id: uid("eg"),
      eventId: input.eventId,
      name: input.name.trim(),
      partySize: input.partySize,
      status: "invited",
    };
    guests = [...guests, guest];
    return clone(guest);
  },

  async removeEventGuest(guestId: string): Promise<void> {
    await delay(200);
    guests = guests.filter((g) => g.id !== guestId);
  },
};
