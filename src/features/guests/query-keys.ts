export const helpRequestKeys = {
  all: (venueId: string) => ["help-requests", venueId] as const,
};

export const sessionsKeys = {
  all: (venueId: string) => ["sessions", venueId] as const,
  byStatus: (venueId: string, status: string) => ["sessions", venueId, status] as const,
};
