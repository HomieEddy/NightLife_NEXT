export const menuKeys = {
  items: (venueId: string) => ["menu", venueId] as const,
  categories: (venueId: string) => ["menu", venueId, "categories"] as const,
  packages: (venueId: string) => ["menu", venueId, "packages"] as const,
  soldOut: (venueId: string) => ["menu", venueId, "sold-out"] as const,
  happyHour: (venueId: string) => ["menu", venueId, "happy-hour"] as const,
};
