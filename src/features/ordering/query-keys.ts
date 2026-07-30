export const ordersKeys = {
  all: (venueId: string) => ["orders", venueId] as const,
};
