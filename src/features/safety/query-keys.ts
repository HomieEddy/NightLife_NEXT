export const incidentsKeys = {
  all: (venueId: string) => ["incidents", venueId] as const,
};
