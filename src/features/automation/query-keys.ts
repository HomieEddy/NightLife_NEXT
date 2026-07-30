export const automationKeys = {
  rules: (venueId: string) => ["automations", venueId, "rules"] as const,
  executions: (venueId: string) => ["automations", venueId, "executions"] as const,
};
