export const analyticsKeys = {
  all: (venueId: string) => ["analytics", venueId] as const,
  depth: (venueId: string, query: string) => ["analytics", venueId, "depth", query] as const,
  historical: (venueId: string, from: string, to: string) => ["analytics", venueId, "historical", from, to] as const,
};

export const reportsKeys = {
  all: (venueId: string) => ["reports", venueId] as const,
};
