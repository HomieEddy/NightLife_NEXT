export const staffKeys = {
  me: (venueId: string) => ["staff", venueId, "me"] as const,
  list: (venueId: string) => ["staff", venueId] as const,
};
