export const ordersKeys = {
  all: (venueId: string) => ["orders", venueId] as const,
  adjustmentReasons: (venueId: string) => ["orders", venueId, "adjustment-reasons"] as const,
  adjustments: (venueId: string) => ["orders", venueId, "adjustments"] as const,
};

export const guestOrderKeys = {
  list: (guestName: string) => ["guest-orders", guestName] as const,
};
