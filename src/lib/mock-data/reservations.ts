import type { Reservation } from "@/lib/types";

const daysAhead = (d: number, h = 21, m = 0) => {
  const dt = new Date();
  dt.setDate(dt.getDate() + d);
  dt.setHours(h, m, 0, 0);
  return dt.toISOString();
};

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
    source: "manager",
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
    source: "manager",
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
];
