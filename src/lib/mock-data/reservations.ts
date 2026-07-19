import type { Reservation } from "@/lib/types";

const daysAhead = (d: number, h = 21, m = 0) => {
  const dt = new Date();
  dt.setDate(dt.getDate() + d);
  dt.setHours(h, m, 0, 0);
  return dt.toISOString();
};

/** Deterministic 6-digit PIN seeded from the reservation id. */
function seededPin(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return String(Math.abs(hash) % 1000000).padStart(6, "0");
}

export const mockReservations: Reservation[] = [
  {
    id: "res-1",
    venueId: "venue-1",
    tableId: "t-vip-3",
    zoneId: "zone-vip",
    guestName: "Jean Dupuis",
    partySize: 10,
    startsAt: daysAhead(0, 22, 30),
    status: "confirmed",
    note: "Fête — bouteille de bienvenue demandée",
    source: "manager",
    channel: "walk-in",
    reservationPin: seededPin("res-1"),
    createdAt: daysAhead(-1, 14, 0),
  },
  {
    id: "res-2",
    venueId: "venue-1",
    tableId: "t-ter-3",
    zoneId: "zone-terrace",
    guestName: "Camille Laurent",
    partySize: 6,
    startsAt: daysAhead(1, 21, 0),
    status: "requested",
    note: "Anniversaire de mariage",
    source: "public",
    channel: "embed",
    guestEmail: "camille.laurent@example.com",
    createdAt: daysAhead(0, 11, 30),
  },
  {
    id: "res-3",
    venueId: "venue-1",
    zoneId: "zone-dance",
    guestName: "Marc Bélanger",
    partySize: 4,
    startsAt: daysAhead(2, 23, 0),
    status: "requested",
    source: "public",
    channel: "direct",
    guestPhone: "+1 514 555 0199",
    createdAt: daysAhead(0, 9, 15),
  },
  {
    id: "res-4",
    venueId: "venue-1",
    tableId: "t-vip-6",
    zoneId: "zone-vip",
    guestName: "Sophie Martin",
    partySize: 12,
    startsAt: daysAhead(-1, 22, 0),
    status: "seated",
    note: "Client VIP",
    source: "manager",
    createdAt: daysAhead(-2, 16, 0),
  },
  {
    id: "res-5",
    venueId: "venue-1",
    tableId: "t-vip-4",
    zoneId: "zone-vip",
    guestName: "Élise Tremblay",
    partySize: 6,
    startsAt: daysAhead(0, 23, 0),
    status: "confirmed",
    note: "Corporate event — bottle service",
    source: "public",
    channel: "embed",
    guestEmail: "elise.t@corp.ca",
    reservationPin: seededPin("res-5"),
    createdAt: daysAhead(-1, 10, 0),
  },
];
