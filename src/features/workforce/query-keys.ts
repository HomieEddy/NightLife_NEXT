export const staffKeys = {
  me: (venueId: string) => ["staff", venueId, "me"] as const,
  list: (venueId: string) => ["staff", venueId] as const,
  shifts: (venueId: string) => ["staff", venueId, "shifts"] as const,
  messages: (venueId: string, channel?: string) =>
    channel ? (["staff", venueId, "messages", channel] as const) : (["staff", venueId, "messages"] as const),
};

export const timeKeys = {
  all: (venueId: string) => ["time", venueId] as const,
  allShifts: (venueId: string) => ["time", venueId, "all-shifts"] as const,
  shifts: (venueId: string, staffId: string) => ["time", venueId, "shifts", staffId] as const,
  swaps: (venueId: string) => ["time", venueId, "swaps"] as const,
  timeOff: (venueId: string, staffId: string) => ["time", venueId, "time-off", staffId] as const,
};

export const certificationKeys = {
  all: (venueId: string) => ["certifications", venueId] as const,
};

export const tipsKeys = {
  list: (venueId: string) => ["tips", venueId] as const,
};
