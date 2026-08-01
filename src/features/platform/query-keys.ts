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
  suppliers: (venueId: string) => ["purchasing", venueId, "suppliers"] as const,
  purchaseOrders: (venueId: string) => ["purchasing", venueId, "orders"] as const,
  supplierItems: (venueId: string) => ["purchasing", venueId, "supplier-items"] as const,
  stocktakes: (venueId: string) => ["purchasing", venueId, "stocktakes"] as const,
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

export const billingKeys = {
  all: (venueId: string) => ["billing", venueId] as const,
  subscription: (venueId: string) => ["billing", venueId, "subscription"] as const,
  plans: (venueId: string) => ["billing", venueId, "plans"] as const,
  invoices: (venueId: string) => ["billing", venueId, "invoices"] as const,
};

export const adminKeys = {
  all: ["admin"] as const,
  leads: ["admin", "leads"] as const,
  lead: (id: string) => ["admin", "leads", id] as const,
  tenants: ["admin", "tenants"] as const,
  tenant: (id: string) => ["admin", "tenants", id] as const,
  plans: ["admin", "plans"] as const,
  telemetry: ["admin", "telemetry"] as const,
};
