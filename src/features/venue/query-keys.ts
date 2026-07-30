export const venueKeys = {
  single: (venueId: string) => ["venue", venueId] as const,
  snapshot: (venueId: string) => ["venue", venueId, "snapshot"] as const,
  zones: (venueId: string) => ["venue", venueId, "zones"] as const,
  tables: (venueId: string) => ["venue", venueId, "tables"] as const,
};
