export const inventoryKeys = {
  all: (venueId: string) => ["inventory", venueId] as const,
  movements: (venueId: string) => ["inventory", venueId, "movements"] as const,
};
