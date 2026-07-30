export const doorKeys = {
  all: (venueId: string) => ["door", venueId] as const,
  occupancy: (venueId: string) => ["door", venueId, "occupancy"] as const,
  admissions: (venueId: string) => ["door", venueId, "admissions"] as const,
  evacuation: (venueId: string) => ["door", venueId, "evacuation"] as const,
  coatCheck: (venueId: string) => ["door", venueId, "coat-check"] as const,
};

export const waitlistKeys = {
  all: (venueId: string) => ["waitlist", venueId] as const,
};
