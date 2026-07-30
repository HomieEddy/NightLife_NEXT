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
  rules: (venueId: string, staffFilter?: string) =>
    staffFilter ? (["commission", venueId, "rules", staffFilter] as const) : (["commission", venueId, "rules"] as const),
  statements: (venueId: string, staffFilter?: string) =>
    staffFilter ? (["commission", venueId, "statements", staffFilter] as const) : (["commission", venueId, "statements"] as const),
};

export const tipsKeys = {
  all: (venueId: string) => ["tips", venueId] as const,
  rule: (venueId: string) => ["tips", venueId, "rule"] as const,
  distributions: (venueId: string) => ["tips", venueId, "distributions"] as const,
  entries: (venueId: string) => ["tips", venueId, "entries"] as const,
};
