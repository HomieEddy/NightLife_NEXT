export const eventsKeys = {
  all: (venueId: string) => ["events", venueId] as const,
};

export const reservationsKeys = {
  all: (venueId: string) => ["reservations", venueId] as const,
  mine: (venueId: string, staffId: string) => ["reservations", venueId, "mine", staffId] as const,
  blackout: (venueId: string) => ["reservations", venueId, "blackout"] as const,
};
