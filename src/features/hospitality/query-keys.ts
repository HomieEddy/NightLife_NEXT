export const eventsKeys = {
  all: (venueId: string) => ["events", venueId] as const,
  guests: (venueId: string) => ["events", venueId, "guests"] as const,
  publicList: (venueSlug: string) => ["events", venueSlug, "public"] as const,
};

export const promotionsKeys = {
  all: (venueId: string) => ["promotions", venueId] as const,
};

export const reservationsKeys = {
  all: (venueId: string) => ["reservations", venueId] as const,
  mine: (venueId: string, staffId: string) => ["reservations", venueId, "mine", staffId] as const,
  blackout: (venueId: string) => ["reservations", venueId, "blackout"] as const,
  publicAvailability: (venueSlug: string) => ["reservations", venueSlug, "public-availability"] as const,
};
