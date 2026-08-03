export const showQueueKeys = {
  active: (venueId: string) => ["show-queue", venueId, "active"] as const,
};

export const chatKeys = {
  channel: (channel: string) => ["chat", channel] as const,
};
