import type { BlackoutDate } from "@/lib/types";

const isoDate = (daysAhead: number) => {
  const dt = new Date();
  dt.setDate(dt.getDate() + daysAhead);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

export const mockBlackoutDates: BlackoutDate[] = [
  {
    id: "bo-1",
    venueId: "venue-1",
    date: isoDate(30),
    reason: "New Year's Eve ÔÇö sold out",
    createdAt: new Date().toISOString(),
  },
  {
    id: "bo-2",
    venueId: "venue-1",
    date: isoDate(-7),
    reason: "Venue closed ÔÇö electrical maintenance",
    zoneId: "zone-dance",
    createdAt: new Date().toISOString(),
  },
];
