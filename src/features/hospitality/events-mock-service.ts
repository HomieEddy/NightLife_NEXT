/**
 * mockEventsService ÔÇö future backend boundary for events and guestlists.
 * The permanent demo counterpart to the PostgreSQL-backed live service.
 */
import type { VenueEvent, EventGuest, EventTalent, TalentStatus } from "@/lib/types";
import { mockEvents, mockEventGuests } from "@/features/hospitality/events-mock-data";
import { mockEventTalent } from "@/features/hospitality/event-talent-mock-data";
import { mockVenue } from "@/features/venue/mock-data";
import { clone, delay, uid } from "@/features/shared/delay";
import { mockStaffService } from "@/features/workforce/staff-mock-service";

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
    /** PR-02: Staff promoter ID ÔÇö required for quota enforcement. */
    promoterId?: string;
  }): Promise<EventGuest> {
    await delay(300);
    // PR-02: enforce guestlist quota if promoterId is provided
    if (input.promoterId) {
      const usage = await this.getQuotaUsage(input.promoterId, input.eventId);
      if (usage.remaining === 0) {
        throw new Error(`Promoter guestlist quota (${usage.quota}) exceeded for this event.`);
      }
      if (usage.remaining !== null && input.partySize > usage.remaining) {
        throw new Error(
          `Adding ${input.partySize} guests exceeds the promoter's remaining quota of ${usage.remaining}.`,
        );
      }
    }
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

  // ÔöÇÔöÇ EV-03: Event cancellation ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

  async cancelEvent(id: string, reason: string): Promise<VenueEvent | null> {
    await delay(300);
    const event = events.find((e) => e.id === id);
    if (!event) return null;
    event.status = "cancelled";
    event.cancellationReason = reason.trim();
    event.cancelledAt = new Date().toISOString();
    return clone(event);
  },

  // ÔöÇÔöÇ EV-01: Artist/talent management ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

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

  // ÔöÇÔöÇ PR-02: Promoter guestlist quota ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ

  async getQuotaUsage(
    promoterId: string,
    eventId: string,
  ): Promise<{ quota: number | null; used: number; remaining: number | null }> {
    await delay(200);
    const promoter = await mockStaffService.getStaffMember(promoterId);
    const quota = promoter?.guestlistQuota ?? null;
    const used = guests
      .filter((g) => g.eventId === eventId)
      .reduce((sum, g) => sum + g.partySize, 0);
    const remaining = quota !== null ? Math.max(0, quota - used) : null;
    return { quota, used, remaining };
  },
};