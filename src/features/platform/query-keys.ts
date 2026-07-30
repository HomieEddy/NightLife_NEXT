export const permissionsKeys = {
  role: (venueId: string) => ["permissions", venueId] as const,
};

export const auditKeys = {
  all: (venueId: string) => ["audit", venueId] as const,
};

export const cashoutKeys = {
  all: (venueId: string) => ["cashout", venueId] as const,
  preview: (venueId: string) => ["cashout", venueId, "preview"] as const,
};

export const purchasingKeys = {
  all: (venueId: string) => ["purchasing", venueId] as const,
};

export const commissionKeys = {
  all: (venueId: string) => ["commission", venueId] as const,
};

export const tipsKeys = {
  all: (venueId: string) => ["tips", venueId] as const,
};
