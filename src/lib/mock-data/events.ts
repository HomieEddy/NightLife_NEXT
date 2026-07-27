import type { VenueEvent, EventGuest } from "@/lib/types";

const iso = (d: number, h: number, m = 0) => {
  const dt = new Date();
  dt.setDate(dt.getDate() + d);
  dt.setHours(h, m, 0, 0);
  return dt.toISOString();
};

export const mockEvents: VenueEvent[] = [
  {
    id: "evt-1",
    venueId: "venue-1",
    name: "Soirée Saint-Laurent",
    description: "Soirée d'ouverture avec DJs résidents et spéciaux sur les bouteilles.",
    startsAt: iso(3, 23, 0),
    endsAt: iso(4, 5, 0),
    zoneId: "zone-dance",
    capacity: 120,
    status: "published",
    guestlistEnabled: true,
    ticketUrl: "https://www.eventbrite.com/e/demo-soiree-saint-laurent",
  },
  {
    id: "evt-2",
    venueId: "venue-1",
    name: "Brunch Champagne VIP",
    description: "Brunch en journée sur le rooftop pour les membres.",
    startsAt: iso(6, 12, 0),
    endsAt: iso(6, 16, 0),
    zoneId: "zone-vip",
    capacity: 40,
    status: "draft",
    guestlistEnabled: true,
  },
  {
    id: "evt-3",
    venueId: "venue-1",
    name: "Silent Disco sur la Terrasse",
    description: "Trois canaux, casques sur la terrasse.",
    startsAt: iso(-2, 22, 0),
    endsAt: iso(-2, 4, 0),
    zoneId: "zone-terrace",
    capacity: 80,
    status: "ended",
    guestlistEnabled: false,
  },
];

export const mockEventGuests: EventGuest[] = [
  { id: "eg-1", eventId: "evt-1", name: "Léa Bernard", partySize: 2, status: "confirmed" },
  { id: "eg-2", eventId: "evt-1", name: "Hugo Petit", partySize: 4, status: "invited" },
  { id: "eg-3", eventId: "evt-1", name: "Manon Girard", partySize: 2, status: "checked-in" },
  { id: "eg-4", eventId: "evt-2", name: "Olivier Roy", partySize: 2, status: "invited" },
];
