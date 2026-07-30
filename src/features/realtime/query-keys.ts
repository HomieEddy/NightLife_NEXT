export const showQueueKeys = {
  active: (venueId: string) => ["show-queue", venueId, "active"] as const,
};
