export const staffKeys = {
  me: (venueId: string) => ["staff", venueId, "me"] as const,
  list: (venueId: string) => ["staff", venueId] as const,
  shifts: (venueId: string) => ["staff", venueId, "shifts"] as const,
  messages: (venueId: string, channel?: string) =>
    channel ? (["staff", venueId, "messages", channel] as const) : (["staff", venueId, "messages"] as const),
};

export const timeKeys = {
  all: (venueId: string) => ["time", venueId] as const,
};
