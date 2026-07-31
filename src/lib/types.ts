/**
 * NightLifeNext domain types.
 *
 * These types define the contract between the UI and the (future) backend.
 * Live implementations map these contracts to Prisma models and API DTOs.
 */

// ---------- Venue ----------

/** One configurable per-order charge — a tax, service charge or flat fee. */
export interface ServiceFee {
  id: string;
  name: string; // e.g. "Service", "TPS", "TVQ"
  type: "percentage" | "flat";
  value: number; // % of subtotal, or $ amount when flat
}

export interface Venue {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  timezone: string;
  currency: "CAD" | "EUR" | "USD" | "GBP";
  openingHours: { day: string; open: string; close: string }[];
  nightStartHour: number;
  nightEndHour: number;
  serviceFees: ServiceFee[]; // applied in order to every guest order
  /** Floor-map canvas proportions (abstract units — controls the aspect ratio). */
  floorMap: { width: number; height: number };
  autoApproveGuests: boolean;
  logoInitials: string;
  /** Minutes an order/help request can sit before the Pulse feed flags it. */
  slaThresholds: {
    orderWarnMinutes: number;
    orderCriticalMinutes: number;
    helpWarnMinutes: number;
    helpCriticalMinutes: number;
  };
  /** Public slug for the embeddable reservation page (/r/[venueSlug]). */
  publicSlug: string;
  /** At last call, synthesize a closeout nudge for every occupied table. */
  lastCallAutoFlagTables: boolean;
  /** Tip percentage presets shown to guests (e.g. [15, 20]). */
  tipPresets: number[];
  /** The default-selected tip percentage when the cart opens. */
  defaultTipPct: number;
  /** Comps at or below this amount are self-service; above it escalates to manager approval. */
  compThresholdCents: number;
  /** Minimum-spend progress ring turns warning-colored once shortfall/minimum crosses this ratio. */
  minimumSpendWarningRatio: number;
  /** The fire-code number the door counts against. */
  legalCapacity: number;
  /** Occupancy/legalCapacity ratio at which Pulse raises a capacity-warning (default 0.9). */
  occupancyWarnRatio: number;
  /** Gates the coat-check surface entirely for venues that don't run one. */
  coatCheckEnabled: boolean;
  /** Forces the ID-check toggle on at admission time (plan 17). */
  doorRequiresIdCheck: boolean;
  /** The legal drinking age in this venue's jurisdiction — defaults to 18 (Quebec). */
  legalDrinkingAge: number;
  /** RV-03: Auto-gratuity rules — triggers based on party size, zone, and table minimum. */
  autoGratuityRules?: {
    id: string;
    /** Minimum party size to trigger this rule. */
    minPartySize: number;
    /** Gratuity percentage to auto-apply (e.g. 18). */
    ratePct: number;
    /** Roles that can override the auto-gratuity at the table. */
    allowOverride?: boolean;
  }[];
  /** RV-07: Per-role comp threshold — below this, the role can comp themselves; above requires manager. */
  roleCompThresholds?: Record<string, number>;
  /** OE-14: Re-entry cutoff time (e.g. "02:00") — after this, exits are final. */
  reEntryCutoffTime?: string;
  /** RV-18: Minutes after which a pending session auto-rejects. */
  pendingSessionTimeoutMinutes?: number;
  /** RV-19: Ratios at which minimum-spend nudge alerts fire (e.g. [0.5, 0.75, 0.9]). */
  minimumSpendCheckpoints?: number[];
  /** RV-07: Minutes after reservation start time before the table is auto-released (AM-01). Default 30. */
  lateArrivalGracePeriodMinutes?: number;
  /** Ordering policy during last call — "block-all" stops all new orders, "allow-last-round" permits one final round. */
  lastCallPolicy?: "block-all" | "allow-last-round";
  /** OE-25: Minutes of continuous work before a break is required. */
  requiredBreakAfterMinutes?: number;
  /** OE-25: Duration of required break in minutes. */
  breakDurationMinutes?: number;
}

export interface Zone {
  id: string;
  venueId: string;
  name: string;
  description: string;
  color: string; // tailwind-friendly hue token, e.g. "violet"
  tableCount: number;
  capacity: number | null;
}

export type TableStatus = "open" | "occupied" | "reserved" | "closed" | "held" | "out-of-service";

export interface VenueTable {
  id: string;
  zoneId: string;
  code: string; // printed on the QR, e.g. "VIP-01"
  label: string;
  seats: number;
  minimumSpend: number | null;
  status: TableStatus;
  qrSlug: string; // /g/<qrSlug>
  /** Floor-map position as % of canvas (2–98). Defaults are auto-laid-out per zone. */
  mapX?: number;
  mapY?: number;
  holdReason?: string;
  heldBy?: string;
  heldUntil?: string;
}

// ---------- Staff ----------

export type StaffRole = "manager" | "host" | "bartender" | "runner" | "security" | "promoter";

/** Roles a manager can assign when creating/editing staff. */
export const ASSIGNABLE_ROLES = ["manager", "host", "bartender", "runner", "security", "promoter"] as const;

export type StaffAccountStatus = "active" | "invited" | "suspended";

export interface StaffMember {
  id: string;
  venueId: string;
  name: string;
  role: StaffRole;
  phone: string;
  email: string;
  accountStatus: StaffAccountStatus;
  assignedZoneIds: string[];
  /** Derived (plan 18): an open TimeEntry exists → true. The manual toggle is retired in live builds. */
  isOnShift: boolean;
  avatarInitials: string;
  /** Plan 18: hourly rate for labour-cost reporting. */
  hourlyRateCents?: number;
  /** Plan 18: tip-pool weighting factor (default 1.0). */
  tipPoolWeight?: number;
  /** Plan 18: employment classification. */
  employmentType?: EmploymentType;
  /** Plan 18: promoter commission rule — attribute bookings to this staff member. */
  commissionRuleId?: string;
  /** PR-02: Max guests this promoter can add to a single event's guestlist. Unlimited when absent. */
  guestlistQuota?: number;
}

/** One recurring weekly shift block — backed by the StaffShift table (plan 03). */
export interface StaffShift {
  id: string;
  staffId: string;
  dayOfWeek: number; // 0 = Sunday
  startTime: string; // "22:00"
  endTime: string;
  zoneId: string | null; // optional zone the shift covers
}

// ---------- Menu ----------

export interface MenuCategory {
  id: string;
  venueId: string;
  name: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  modifierGroups: ModifierGroup[];
}

export type ModifierKind = "washer" | "presentation";

export interface ModifierOption {
  id: string;
  name: string;
  priceDelta: number;
  maxQuantity: number;
  inventoryItemId?: string;
  isActive: boolean;
}

export interface ModifierGroup {
  id: string;
  name: string;
  kind: ModifierKind;
  required: boolean;
  maxSelections: number; // 1 = single choice
  isActive: boolean;
  options: ModifierOption[];
}

/** Icon keys rendered by <BottleIcon> — no raw emoji strings anywhere. */
export type BottleIconKey =
  | "champagne"
  | "tequila"
  | "vodka"
  | "cognac"
  | "rum"
  | "whisky"
  | "gin"
  | "washer"
  | "package";

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  icon: BottleIconKey;
  tags: ("popular" | "new" | "premium" | "limited")[];
  isAvailable: boolean; // manual 86 switch
  inventory: number; // bottles left tonight; 0 = sold out regardless of isAvailable
  /** Drives the responsible-service drink counter (plan 17) — non-alcoholic items never count. */
  isAlcoholic: boolean;
  abv?: number; // % alcohol by volume, alcoholic items only
  allergens: string[]; // e.g. ["nuts", "dairy"] — empty = none declared
  /** Plan 19: unit of measure for costing and partial-bottle tracking. */
  unitOfMeasure?: "bottle" | "ml" | "oz" | "each" | "keg";
  /** Plan 19: serving size in the item's own unit — drives pour depletion vs whole-bottle depletion. */
  servingSize?: number;
  /** Plan 19: per-day-of-week par levels — Wednesday par ≠ Saturday par. */
  parLevels?: Record<number, number>; // dayOfWeek: quantity
  /** Plan 19: trigger point for the reorder alert below parForDate. */
  reorderPoint?: number;
  /** Plan 19: weighted average cost, recomputed on each receipt — never hand-edited (INV-C4). */
  avgCostCents?: number;
}

// ---------- Inventory ----------

export type StockMovementType = "restock" | "sale" | "adjustment" | "waste" | "transfer" | "return";

/**
 * Every inventory change is a movement — restocks, sales and manual
 * corrections. The item's `inventory` field is the running balance.
 * Live mode persists this as an append-only stock_movements ledger row.
 */
export interface StockMovement {
  id: string;
  menuItemId: string;
  itemName: string; // denormalized for display
  type: StockMovementType;
  delta: number; // positive = stock in, negative = stock out
  note?: string;
  createdAt: string;
  /** Set when this movement is the stock-return side of a void TabAdjustment (INV-T2). */
  voidAdjustmentId?: string;
  /** Plan 19: per-unit cost at receipt — consumption costs at weighted average. */
  unitCostCents?: number;
  /** Plan 19: links this restock to its purchase order line. */
  purchaseOrderId?: string;
  /** Plan 19: links this adjustment to its stocktake session. */
  stocktakeId?: string;
  /** Plan 19: reason code for waste events (spill, breakage, expired, comp-prep, training). */
  wasteReason?: string;
}

/** Logged the moment a bottle sells out or gets manually 86'd — feeds the live 86-board. */
export interface SoldOutEvent {
  id: string;
  itemId: string;
  itemName: string;
  at: string; // ISO
}

// ---------- Bottle packages ----------

export interface PackageComponent {
  menuItemId: string;
  quantity: number;
}

/**
 * A curated bundle of bottles (e.g. "Mr Ace" = 5× Ace of Spades + washers).
 * Priced by the manager; value/savings and availability are derived from the
 * component items' prices and inventory.
 */
export interface BottlePackage {
  id: string;
  venueId: string;
  name: string;
  description: string;
  price: number;
  components: PackageComponent[];
  modifierGroups: ModifierGroup[];
  isActive: boolean;
}

export interface PackageQuote {
  componentsValue: number;
  savings: number;
  maxQuantity: number;
  lines: { menuItemId: string; name: string; quantity: number; unitPrice: number }[];
}

export interface HappyHourRule {
  id: string;
  venueId: string;
  name: string;
  daysOfWeek: number[]; // 0 = Sunday
  startTime: string; // "22:00"
  endTime: string;
  discountPct: number;
  appliesToCategoryIds: string[];
  isActive: boolean;
}

// ---------- Guests & sessions ----------

export type GuestSessionStatus =
  | "pending"
  | "approved"
  | "denied"
  | "closure-requested" // guest asked to close the tab (all orders delivered)
  | "closed"
  | "merged"; // folded into another session's tab (see parentSessionId) — plan 16

export interface GuestSession {
  id: string;
  tableId: string;
  tableCode: string;
  zoneName: string;
  displayName: string;
  partySize: number;
  status: GuestSessionStatus;
  createdAt: string; // ISO
  settledExternallyAt?: string;
  settlementMethod?: SettlementMethod;
  // TODO(backend): stamped at seat time from the reservation that gated the table
  promoterId?: string;
  /**
   * The venue's commitment for this tab, snapshotted from the table (or the
   * seating reservation's own minimumSpendCents, when set) at approval time —
   * editing the table's minimum mid-night must never rewrite an open tab.
   */
  minimumSpendCents?: number;
  /** Set when this session absorbed another via mockGuestsService.mergeSession(). */
  parentSessionId?: string;
  /** History breadcrumb — the table this session started at, before a transfer. */
  transferredFromTableId?: string;
  /** Links this session to a persistent guest identity only when a host attaches one (opt-in, plan 17). */
  guestProfileId?: string;
  /** Set by service:refuse — blocks new orders for this session with a guest-facing explanation. */
  serviceRefusedAt?: string;
  serviceRefusedReason?: string;
  /** RV-20: Per-session spending cap — manager can override. Caps new orders when reached. */
  spendingCapCents?: number;
  /** RV-18: Auto-timeout minutes — pending sessions auto-rejected after this many minutes. Default from venue config. */
  pendingTimeoutMinutes?: number;
  lastCallOrderPlaced?: boolean;
  assignedHostId?: string;
  assignedHostName?: string;
}

export type SettlementMethod = "terminal" | "cash" | "house";

// ---------- Tab ledger: adjustments, audit trail, cash-out (plan 16) ----------

/**
 * void — it never happened: removes the line from revenue AND returns stock.
 * comp — it happened, the guest doesn't pay: stays in depletion/performance volume,
 *   leaves revenue, lands in a comp-cost bucket. Writes no stock movement.
 * discount — it happened, the guest pays less: reduces revenue by the delta only.
 */
export type TabAdjustmentKind = "void" | "comp" | "discount";

/**
 * Append-only tab ledger row — the record of every correction made to a
 * session's balance after an order was placed. Corrections are new rows (a
 * reversal), never edits or deletes (same rule as StockMovement, INV-I1).
 */
export interface TabAdjustment {
  id: string;
  venueId: string;
  sessionId: string;
  orderId?: string;
  orderItemId?: string;
  kind: TabAdjustmentKind;
  /** Positive amount in cents — the size of the correction, never signed. */
  amountCents: number;
  /** Quantity of the line affected, for partial-quantity voids/comps. */
  quantity?: number;
  reasonCode: string; // matches an AdjustmentReason.code for this venue+kind
  note?: string;
  authorStaffId: string;
  authorStaffName: string;
  createdAt: string; // ISO
  /** Set on the original row once a later row reverses it — the original is never edited. */
  reversedByAdjustmentId?: string;
}

/** Venue-configurable reason vocabulary — mandatory dropdown, no free-text-only adjustments. */
export interface AdjustmentReason {
  id: string;
  venueId: string;
  kind: TabAdjustmentKind;
  code: string;
  label: string;
  isActive: boolean;
}

/**
 * Derived, never stored (same rule as AttentionItem) — one pure function in
 * src/lib/tab.ts computes this from a session's orders + adjustments.
 */
export interface SessionBalance {
  sessionId: string;
  grossCents: number; // sum of order totals, unadjusted
  voidCents: number;
  compCents: number;
  discountCents: number;
  adjustmentsCents: number; // voidCents + compCents + discountCents
  netCents: number; // grossCents - adjustmentsCents
  minimumSpendCents: number; // 0 when the tab has no commitment
  shortfallCents: number; // max(0, minimumSpendCents - netCents)
  settledCents: number; // netCents + shortfallCents — what closes the tab
}

/** Every action already flagged `sensitive: true` writes one, plus the new tab/cashout actions. */
export interface AuditEntry {
  id: string;
  venueId: string;
  actorStaffId: string;
  actorName: string;
  action: string; // StaffAction | AdminAction — kept as string so this table stays generic across plans
  targetType: string; // "order" | "session" | "cashout" | ...
  targetId: string;
  summary: string; // human-readable one-liner, e.g. "Comped 1× Grey Goose 750ml — service recovery"
  metadata?: Record<string, unknown>;
  createdAt: string; // ISO
}

/** One per-shift reconciliation — the Z-report. */
export interface ShiftCashout {
  id: string;
  venueId: string;
  staffId?: string; // set for a bartender's own drawer; absent for the manager's venue-wide close
  businessDate: string; // "YYYY-MM-DD" bucketed by the venue's night config, never toDateString()
  openedAt: string; // ISO
  closedAt: string; // ISO
  expectedByMethod: Record<SettlementMethod, number>; // cents
  countedByMethod: Record<SettlementMethod, number>; // cents, entered by the closer
  varianceCents: number; // Σ counted - Σ expected
  note?: string;
  closedByStaffId: string;
  closedByStaffName: string;
}

// ---------- Orders ----------

export type OrderStatus =
  | "pending" // submitted, waiting for staff acceptance
  | "accepted"
  | "preparing"
  | "ready"
  | "delivered"
  | "cancelled";

export interface OrderItemModifier {
  groupId: string;
  optionId: string;
  kind: ModifierKind;
  groupName: string;
  optionName: string;
  priceDelta: number;
  quantity: number;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  modifiers: OrderItemModifier[];
  note?: string;
}

export interface Order {
  id: string;
  code: string; // short human code, e.g. "A-042"
  venueId: string;
  /** Guest session this order belongs to (drives the per-table session overview). */
  sessionId?: string;
  tableId: string;
  tableCode: string;
  zoneId: string;
  zoneName: string;
  guestName: string;
  items: OrderItem[];
  subtotal: number;
  serviceFee: number;
  feeBreakdown?: { fee: ServiceFee; amount: number }[];
  tip: number;
  total: number;
  status: OrderStatus;
  placedAt: string; // ISO
  updatedAt: string;
  /** Set once when pending → accepted. acceptedAt - placedAt is the accept-wait metric. */
  acceptedAt?: string;
  /** Set when a staff member claims (or auto-claimed on accept). */
  claimedAt?: string;
  /** Runner/bartender who tapped "Claim" — prevents two staff working the same order. */
  claimedByStaffId?: string;
  claimedByStaffName?: string;
  /** Set when this is a "send a bottle" gift — billed to tableId/tableCode above, delivered here instead. */
  giftToTableId?: string;
  giftToTableCode?: string;
  giftNote?: string;
  /** Promotion snapshot — set when a promo code was applied at order time. */
  promotionId?: string;
  promotionCode?: string;
  promotionCents?: number;
  /** Happy-hour rule + discount applied at order time — persisted snapshot. */
  happyHourRuleId?: string;
  happyHourCents?: number;
  /** RV-05: Computed priority score (zone weight × minimum spend × session age × order type). Higher = fulfill first. */
  priorityScore?: number;
  isRushed?: boolean;
  rushedBy?: string;
  rushedAt?: string;
}

// ---------- Help requests ----------

export type HelpRequestType = "call-waiter" | "refill-ice" | "clean-table" | "security" | "bill";
export type HelpRequestStatus = "open" | "acknowledged" | "resolved";

export interface HelpRequest {
  id: string;
  sessionId: string;
  tableCode: string;
  zoneId: string;
  zoneName: string;
  guestName: string;
  type: HelpRequestType;
  status: HelpRequestStatus;
  createdAt: string;
  resolvedByStaffId?: string;
  resolvedByStaffName?: string;
}

// ---------- Cart (guest client state) ----------

export interface CartLine {
  lineId: string;
  menuItem: MenuItem;
  quantity: number;
  modifiers: OrderItemModifier[];
  note?: string;
}

// ---------- Chat ----------

export interface ChatMessage {
  id: string;
  channel: "floor" | "bar" | "security";
  authorId: string;
  authorName: string;
  authorRole: StaffRole;
  body: string;
  sentAt: string;
}

/** One order's bottle-presentation walk-out — the "show floor" lock prevents two colliding at once. */
export interface ActiveShow {
  orderId: string;
  tableCode: string;
  zoneName: string;
  label: string; // e.g. "Sparkler parade"
  staffName: string;
  startedAt: string; // ISO
}

// ---------- Live floor pulse ----------

export type AttentionSeverity = "warning" | "critical";
export type AttentionItemType =
  | "order-overdue"
  | "help-open"
  | "table-closeout"
  | "table-under-minimum"
  | "capacity-warning"
  | "waitlist-overdue"
  | "incident-open"
  | "zone-uncovered"
  | "clock-out-missing"
  | "stock-below-par"
  | "po-overdue"
  | "target-breach";

/** One row in the manager's live "needs attention" feed — always derived, never stored. */
export interface AttentionItem {
  id: string; // "order-{orderId}" / "help-{requestId}" / "table-{tableId}"
  type: AttentionItemType;
  severity: AttentionSeverity;
  tableId: string;
  tableCode: string;
  zoneName: string;
  message: string; // e.g. "Order A-042 pending 8 min"
  ageMinutes: number;
}

/** A manager's urgent message pushed to every staff device at once. */
export interface Broadcast {
  id: string;
  message: string;
  sentAt: string; // ISO
  sentBy: string;
}

// ---------- Analytics ----------

export interface RevenuePoint {
  label: string; // e.g. "22:00" or "Fri"
  revenue: number;
  orders: number;
}

export interface StaffPerformancePoint {
  staffId: string;
  name: string;
  role: StaffRole;
  ordersDelivered: number;
  avgDeliveryMinutes: number;
  revenueServed: number;
  avgAcceptMinutes?: number;
  helpResolved?: number;
  avgHelpMinutes?: number;
  ordersPerShiftHour?: number;
}

export interface CategoryDepletionPoint {
  categoryId: string;
  categoryName: string;
  unitsSold: number;
  unitsInStock: number;
  sellThrough?: number;
  soldOutMinutes?: number;
  restockUnits?: number;
  deadItem?: boolean;
}

// ---------- Analytics: new domain sections ----------

export interface SessionAnalytics {
  totalSessions: number;
  approvalRate: number;
  denialRate: number;
  avgApprovalMinutes: number;
  avgDurationMinutes: number;
  avgPartySize: number;
  revenuePerSession: number;
  revenuePerGuest: number;
  // Staff-recorded at tab close (see staff approvals) — the app never processes payments.
  settlementMix: { method: SettlementMethod; count: number; pct: number }[];
  avgClosureMinutes: number;
}

export interface ReservationAnalytics {
  requested: number;
  confirmed: number;
  seated: number;
  completed: number;
  cancelled: number;
  confirmRate: number;
  seatedRate: number;
  cancellationRate: number;
  noShowRate: number;
  avgLeadDays: number;
  totalCovers: number;
  sourceSplit: { source: "manager" | "public"; count: number; pct: number }[];
  channelSplit: { channel: ReservationChannel | "manager"; count: number; pct: number }[];
  partySizeDistribution: { size: number; count: number }[];
}

export interface HappyHourAnalytics {
  rules: {
    ruleId: string;
    ruleName: string;
    orders: number;
    revenue: number;
    discountGiven: number;
    categoryUpliftPct: number;
  }[];
  totalDiscountGiven: number;
  totalHhOrders: number;
  totalHhRevenue: number;
}

export interface EventAnalytics {
  events: {
    eventId: string;
    eventName: string;
    invited: number;
    confirmed: number;
    checkedIn: number;
    capacityUtilization: number;
    guestlistConversion: number;
    eventRevenue: number;
    avgWeekdayRevenue: number;
  }[];
  totalEvents: number;
  avgCapacityUtilization: number;
}

export interface PromotionAnalytics {
  promotions: {
    promotionId: string;
    code: string;
    redemptions: number;
    discountCost: number;
    attributedRevenue: number;
    aovWithPromo: number;
    aovWithoutPromo: number;
  }[];
  totalRedemptions: number;
  totalDiscountCost: number;
}

export interface OrderFunnelAnalytics {
  placed: number;
  accepted: number;
  preparing: number;
  delivered: number;
  cancelled: number;
  cancellationRate: number;
  tipRate: number;
  avgTip: number;
  serviceFeeRevenue: number;
  giftOrders: number;
  giftRevenue: number;
  modifierAttachRate: number;
}

export interface InventoryDepthAnalytics {
  soldOutEventsPerNight: number;
  totalSoldOutMinutes: number;
  restockSaleRatio: number;
  deadItems: number;
}

export interface PromoterPerformance {
  promoterId: string;
  promoterName: string;
  reservationsCreated: number;
  reservationsConfirmed: number;
  reservationsSeated: number;
  showUpRate: number;
  guestsFunneled: number;
  attributedRevenue: number;
  avgSpendPerGuest: number;
  avgSpendPerParty: number;
  topTable?: { tableCode: string; revenue: number };
}

export interface PromoterAnalytics {
  promoters: PromoterPerformance[];
  totalGuestsFunneled: number;
  totalAttributedRevenue: number;
}

export interface AdjustmentAnalytics {
  voidCount: number;
  compCount: number;
  discountCount: number;
  voidCents: number;
  compCents: number;
  discountCents: number;
  voidRate: number; // adjustmentsCents / grossCents, per kind
  compRate: number;
  discountRate: number;
  byReason: { kind: TabAdjustmentKind; reasonCode: string; count: number; amountCents: number }[];
}

export interface OrderEtaMetrics {
  avgAcceptMinutes: number;
  avgPrepMinutes: number;
  avgTotalMinutes: number;
}

export interface AnalyticsSummary {
  revenueTonight: number;
  revenueDeltaPct: number;
  ordersTonight: number;
  ordersDeltaPct: number;
  avgOrderValue: number;
  avgOrderDeltaPct: number;
  activeTables: number;
  totalTables: number;
  avgFulfillmentMinutes: number;
  orderEta?: OrderEtaMetrics;
  topItems: { name: string; count: number; revenue: number; categoryId?: string }[];
  revenueByHour: RevenuePoint[];
  revenueByDay: RevenuePoint[];
  revenueByZone: { zoneId: string; zoneName: string; revenue: number }[];
  staffPerformance: StaffPerformancePoint[];
  categoryDepletion: CategoryDepletionPoint[];
  sessions?: SessionAnalytics;
  reservations?: ReservationAnalytics;
  happyHours?: HappyHourAnalytics;
  events?: EventAnalytics;
  promotions?: PromotionAnalytics;
  orderFunnel?: OrderFunnelAnalytics;
  inventoryDepth?: InventoryDepthAnalytics;
  promoters?: PromoterAnalytics;
  adjustments?: AdjustmentAnalytics;
  pourCostPercent?: number;
  grossMarginPercent?: number;
}

export interface HistoricalAnalytics {
  from: string;
  to: string;
  days: number;
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  pourCostPercent: number;
  grossMarginPercent: number;
  bestNight: RevenuePoint;
  series: RevenuePoint[];
  revenueByZone: { zoneId: string; zoneName: string; revenue: number }[];
  topItems: { name: string; count: number; revenue: number; categoryId?: string }[];
  staffPerformance: StaffPerformancePoint[];
  categoryDepletion: CategoryDepletionPoint[];
  orderEta?: OrderEtaMetrics;
  sessions?: SessionAnalytics;
  reservations?: ReservationAnalytics;
  happyHours?: HappyHourAnalytics;
  events?: EventAnalytics;
  promotions?: PromotionAnalytics;
  orderFunnel?: OrderFunnelAnalytics;
  inventoryDepth?: InventoryDepthAnalytics;
  promoters?: PromoterAnalytics;
  adjustments?: AdjustmentAnalytics;
}

export const REPORT_METRICS = [
  { id: "revenue", label: "Revenue & orders" },
  { id: "zones", label: "Revenue by zone" },
  { id: "top-items", label: "Top items" },
  { id: "staff", label: "Staff performance" },
  { id: "inventory", label: "Inventory depletion" },
  { id: "sessions", label: "Guest sessions" },
  { id: "reservations", label: "Reservations" },
  { id: "happy-hours", label: "Happy hours" },
  { id: "events", label: "Events" },
  { id: "promotions", label: "Promotions" },
  { id: "order-funnel", label: "Order funnel" },
  { id: "service-fees", label: "Service fees" },
  { id: "promoter-funnel", label: "Promoter funnel" },
  { id: "promoter-revenue", label: "Promoter revenue" },
  { id: "adjustments", label: "Comps, voids & discounts" },
] as const;

export type ReportMetric = (typeof REPORT_METRICS)[number]["id"];

export interface ReportSchedule {
  frequency: "daily" | "weekly" | "monthly";
  recipient: string;
}

export interface SavedReport {
  id: string;
  name: string;
  metrics: ReportMetric[];
  rangeDays: number;
  schedule: ReportSchedule | null;
  createdAt: string;
  lastRunAt: string | null;
}

// ---------- Platform admin ----------

export type LeadStatus = "new" | "contacted" | "demo" | "negotiating" | "won" | "lost";

export type LeadSource = "landing-page" | "referral" | "outbound" | "event";

/** Timestamped touchpoint on a lead — calls, emails, demos, stage moves. */
export interface LeadActivity {
  id: string;
  at: string; // ISO
  text: string;
}

export interface Lead {
  id: string;
  venueName: string;
  contactName: string;
  email: string;
  phone: string;
  city: string;
  status: LeadStatus;
  source: LeadSource;
  /** Estimated annual contract value. */
  dealValue: number;
  notes: string;
  activity: LeadActivity[];
  createdAt: string;
}

export type TenantPlan = "starter" | "pro" | "enterprise";
export type TenantStatus = "active" | "trial" | "suspended";

/** Operational counts only — never sales/revenue amounts (INV-P2). */
export interface TenantMetrics {
  orderCount30d: number;
  sessionCount30d: number;
  tableCount: number;
  staffCount: number;
  zoneCount: number;
  lastActivityAt: string; // ISO
}

export interface TenantStaffMember {
  id: string;
  name: string;
  role: StaffRole;
  email: string;
}

/** Provisioning-time settings snapshot shown on the tenant detail page. */
export interface TenantProvisioning {
  timezone: string;
  currency: string;
  serviceFees: { name: string; type: "percentage" | "flat"; value: number }[];
  menuCategories: string[];
}

export interface Tenant {
  id: string;
  slug: string;
  venueName: string;
  plan: TenantPlan;
  status: TenantStatus;
  city: string;
  /** What the tenant pays the platform per month — not the tenant's own sales. */
  mrr: number;
  metrics: TenantMetrics;
  staff: TenantStaffMember[];
  provisioning: TenantProvisioning;
  createdAt: string;
}

// ---------- Plan entitlements (platform-configured) ----------

/** One key per gateable nav module; core modules (orders, menu, tables…) have no key. */
export type FeatureKey =
  | "analytics"
  | "reports"
  | "inventory"
  | "floor-map"
  | "happy-hour"
  | "reservations"
  | "events"
  | "promotions"
  | "chat"
  | "multi-venue"
  | "door"
  | "guest-crm"
  | "incidents";

export interface FeatureDef {
  key: FeatureKey;
  label: string;
  description: string;
}

export interface PlanConfig {
  id: TenantPlan;
  name: string;
  monthlyPrice: number;
  tagline: string;
  highlight: boolean;
  tableLimit: number | null; // null = unlimited
  staffLimit: number | null;
  features: FeatureKey[];
}

// ---------- Platform settings ----------

export type TelemetryCategory = "monitoring" | "logs" | "analytics" | "infra" | "other";

/** External observability shortcut (Sentry, Grafana…) — a link, never embedded stats. */
export interface TelemetryLink {
  id: string;
  name: string;
  url: string;
  category: TelemetryCategory;
}

// ---------- Auth (demo) ----------

export type AuthRole = "manager" | "staff" | "admin";

/** Demo identity the shared /login screen signs in as. No real auth yet. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: AuthRole;
  venueId?: string;
  staffRole?: StaffRole;
}

export interface SignInInput {
  email: string;
  pin: string;
  role: AuthRole;
}

// ---------- Reservations ----------

export type ReservationStatus =
  | "requested"
  | "confirmed"
  | "seated"
  | "cancelled"
  | "completed"
  | "no-show";

export type ReservationChannel = "embed" | "direct" | "walk-in" | "promoter";

export interface Reservation {
  id: string;
  venueId: string;
  tableId?: string;
  zoneId?: string;
  eventId?: string;
  guestName: string;
  partySize: number;
  startsAt: string; // ISO
  endsAt?: string; // ISO
  status: ReservationStatus;
  note?: string;
  source: "manager" | "public";
  channel?: ReservationChannel;
  guestEmail?: string;
  guestPhone?: string;
  reservationPin?: string;
  promoterId?: string;
  /** Bottle-service term negotiated at booking time — makes BottlePackage reachable pre-seating. */
  packageId?: string;
  /** Overrides the table's default minimum for this booking; wins over the table at seating. */
  minimumSpendCents?: number;
  /** Terms recorded at booking, not charged — no payment processing (PRD §4). */
  expectedDurationMinutes?: number;
  depositTermsNote?: string;
  cancellationPolicyNote?: string;
  /** 1st or 2nd seating, for venues that turn tables twice a night. */
  seatingNumber?: 1 | 2;
  /** Resolved via dedupe at booking time — links the reservation to a persistent guest identity. */
  guestProfileId?: string;
  /** RV-13: Celebration type flagged at booking — auto-surfaced on guest profile and at every touchpoint. */
  celebration?: "birthday" | "anniversary" | "other";
  /** RV-09: Deposit charged at booking (outside the app, per PRD §4) — status tracked inside. */
  depositCents?: number;
  depositStatus?: "pending" | "paid" | "forfeited";
  /** RV-10: Cancellation deadline; after this, the deposit is forfeited. */
  cancellationDeadlineTime?: string;
  cancellationPenaltyCents?: number;
  /** RV-11: Confirmed reservations auto-release if not seated by this time. */
  holdUntil?: string;
  /** RV-10: Set when this reservation was bumped — links to the original booking that lost the table. */
  bumpedFromId?: string;
  /** RV-10: Reason recorded for the bump (e.g. "walk-in whale, reassigned to table X"). */
  bumpReason?: string;
  /** RV-10: Table the bumped guest was offered as an alternative. */
  alternativeTableId?: string;
  createdAt: string; // ISO
}

/** RV-06: A date on which the venue is closed or fully booked — reservations are blocked. */
export interface BlackoutDate {
  id: string;
  venueId: string;
  date: string; // YYYY-MM-DD
  reason: string;
  /** When set, the blackout only applies to this zone rather than the whole venue. */
  zoneId?: string;
  createdAt: string; // ISO
}

// ---------- Events & promotions ----------

export type EventStatus = "draft" | "published" | "live" | "ended" | "cancelled";

export interface VenueEvent {
  id: string;
  venueId: string;
  name: string;
  description: string;
  startsAt: string; // ISO
  endsAt: string; // ISO
  zoneId?: string;
  capacity: number;
  status: EventStatus;
  guestlistEnabled: boolean;
  ticketUrl?: string;
  /** EV-03: Reason for cancellation — set when status moves to 'cancelled'. */
  cancellationReason?: string;
  /** EV-03: ISO timestamp of when the event was cancelled. */
  cancelledAt?: string;
}

/** Event-scoped attendee name — not a stored customer/profile, unless resolved to a regular. */
export interface EventGuest {
  id: string;
  eventId: string;
  name: string;
  partySize: number;
  status: "invited" | "confirmed" | "checked-in";
  /** Set when a repeat guestlist name resolves to a known GuestProfile (plan 17). */
  guestProfileId?: string;
  /** PR-02: Staff promoter ID for quota enforcement. */
  promoterId?: string;
}

/** EV-01: Artist/talent booked for an event — DJ, MC, performer, host, etc. */
export type TalentRole = "dj" | "mc" | "performer" | "host" | "dancer" | "musician" | "other";
export type TalentStatus = "scheduled" | "arrived" | "performing" | "completed" | "cancelled";

export interface TalentSetTime {
  start: string; // "22:00"
  end: string;   // "01:00"
}

export interface EventTalent {
  id: string;
  eventId: string;
  venueId: string;
  name: string;
  role: TalentRole;
  setTimes: TalentSetTime[];
  /** When the talent is expected to arrive for soundcheck / setup. */
  arrivalTime?: string; // ISO
  /** Technical/hospitality rider — equipment, food, drinks, etc. */
  rider?: string;
  /** Green room or backstage assignment. */
  greenRoom?: string;
  status: TalentStatus;
  createdAt: string; // ISO
}

export type PromotionType = "percentage" | "flat";
export type PromotionStatus = "active" | "scheduled" | "expired";

export interface Promotion {
  id: string;
  venueId: string;
  code: string; // e.g. "WELCOME10"
  name: string;
  type: PromotionType;
  value: number; // % or $ amount
  appliesToCategoryIds: string[]; // empty = all categories
  startsAt: string; // ISO
  endsAt: string; // ISO
  status: PromotionStatus;
  redemptionCount: number;
}

// ---------- Door, arrival & guest identity (plan 17) ----------

/** Free-form-but-bounded labels a host/security can pin to a profile. */
export type GuestTag = "regular" | "industry" | "influencer" | "birthday" | "allergy-noted" | "high-spender";
export type GuestVipTier = "none" | "regular" | "vip" | "host-list";
export type GuestStatus = "active" | "banned";

/**
 * A persistent guest identity — created only when someone *gives* us identity
 * (reservation, guestlist entry, door ID check, or a host tagging a regular).
 * QR sessions stay anonymous unless a host links one (GuestLink). Never store
 * a document scan or number — `dobYear` only, never a full DOB.
 */
export interface GuestProfile {
  id: string;
  venueId: string;
  displayName: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  email?: string;
  dobYear?: number;
  tags: GuestTag[];
  vipTier: GuestVipTier;
  status: GuestStatus;
  banReason?: string;
  bannedUntil?: string;
  bannedByStaffId?: string;
  notes?: string;
  marketingConsent: { email: boolean; sms: boolean; capturedAt: string; source: string };
  /** RV-12: Structured guest preferences surfaced at every touchpoint. */
  preferences?: {
    preferredTable?: string;
    preferredDrink?: string;
    dietary?: string;
    allergies?: string;
    celebrationDate?: string; // birthday or anniversary date
  };
  /** RV-14: Guest value scoring (recency, frequency, monetary). Recomputed nightly, never hand-edited. */
  valueScore?: number; // 0–100 composite score
  /** RV-15: Watchlist status — alerts at admission but does NOT block. Separate from ban. */
  watchlist?: { reason: string; addedByStaffId: string; addedAt: string };
  /** CRM-01: Staff-authored notes viewable at every guest touchpoint. */
  staffNotes?: { text: string; authorStaffId: string; authorName: string; at: string }[];
  /** CRM-02: Other profiles this guest "always comes with" (many-to-many). */
  linkedProfileIds?: string[];
  /** CRM-03: Profile photo URL for VIP recognition and banned-guest identification. */
  photoUrl?: string;
  createdAt: string; // ISO
  /** Rollups — recomputed from sessions/admissions (AD-11 pattern), never hand-edited. */
  lastVisitAt?: string;
  visitCount: number;
  lifetimeNetCents: number;
}

/** The join that keeps identity opt-in — a GuestSession with no link is today's anonymous QR guest. */
export interface GuestLink {
  id: string;
  guestProfileId: string;
  sessionId?: string;
  reservationId?: string;
  eventGuestId?: string;
  admissionId?: string;
  createdAt: string; // ISO
}

export type AdmissionType = "guestlist" | "comp" | "cover" | "reservation" | "member";
export type AdmissionSource = "walk-in" | "reservation" | "guestlist" | "re-entry";

/** Records the *check*, never the document — no scans, no document numbers. */
export interface AdmissionIdCheck {
  checked: boolean;
  dobVerified: boolean;
  /** Year of birth verified at the door — never the full DOB unless the guest profile gives it explicitly (Law 25). */
  yearOfBirth?: number;
  byStaffId: string;
  at: string; // ISO
}

/** Append-only — the arrival log the door writes to on every admit/re-entry. */
export interface Admission {
  id: string;
  venueId: string;
  businessDate: string; // bucketed via businessDateFor(nightEndHour), never toDateString()
  guestProfileId?: string;
  partySize: number;
  admissionType: AdmissionType;
  amountOwedCents: number;
  source: AdmissionSource;
  reservationId?: string;
  eventGuestId?: string;
  idCheck?: AdmissionIdCheck;
  admittedByStaffId: string;
  admittedByStaffName: string;
  admittedAt: string; // ISO
  exitedAt?: string;
  /** Set when this row is a re-entry — reuses the original admission's cover, not double-counted. */
  reEntryOfAdmissionId?: string;
  /** OE-12: Physical identifier assigned at admission for in-venue verification. */
  wristband?: { number: string; color: string; assignedAt: string };
  /** OE-15: Distinguishes a smoke break (re-entry expected) from a final exit. */
  exitType?: "final" | "smoke-break";
  groupAdmissionId?: string;
}

/**
 * Append-only occupancy ledger — same discipline as StockMovement (INV-I1).
 * Current occupancy = Σ delta for the business date. Never derived from
 * table state — most of the room isn't at a table.
 */
export interface OccupancyEvent {
  id: string;
  venueId: string;
  businessDate: string;
  delta: number;
  reason: string;
  staffId: string;
  at: string; // ISO
}

export type WaitlistStatus = "waiting" | "notified" | "seated" | "left" | "expired";

/** Position is derived from joinedAt within status "waiting" — never a mutable stored int. */
export interface WaitlistEntry {
  id: string;
  venueId: string;
  guestProfileId?: string;
  name: string;
  partySize: number;
  phone?: string;
  quotedMinutes: number;
  status: WaitlistStatus;
  joinedAt: string; // ISO
  notifiedAt?: string;
}

/** Gated entirely behind venue.coatCheckEnabled. */
export interface CoatCheckTicket {
  id: string;
  venueId: string;
  businessDate: string;
  ticketNumber: number;
  guestProfileId?: string;
  itemCount: number;
  checkedInAt: string; // ISO
  claimedAt?: string;
  staffId: string;
}

export type IncidentType =
  | "ejection"
  | "refused-entry"
  | "medical"
  | "altercation"
  | "theft"
  | "property-damage"
  | "police"
  | "staff-injury"
  | "other";
export type IncidentSeverity = "low" | "medium" | "high";
export type IncidentStatus = "open" | "resolved";

/**
 * Security's core object — the reason a venue keeps its licence. Narrative is
 * immutable after submit; follow-ups are appended IncidentNote rows. Writes
 * an AuditEntry in the same logical operation that creates it (plan 16).
 * A refused-entry incident with a guestProfileId can set that profile's
 * status to "banned" in the same transaction — this *is* RefusalOfService,
 * modelled as an Incident rather than a separate table.
 */
export interface Incident {
  id: string;
  venueId: string;
  businessDate: string;
  type: IncidentType;
  severity: IncidentSeverity;
  occurredAt: string; // ISO
  zoneId?: string;
  tableId?: string;
  /** SI-01: Free-text description of the exact location (e.g. "Near the VIP staircase, east side"). */
  locationDescription?: string;
  guestProfileId?: string;
  involvedStaffIds: string[];
  narrative: string;
  actionsTaken: string;
  policeInvolved: boolean;
  reportedByStaffId: string;
  reportedByStaffName: string;
  status: IncidentStatus;
  /** S-02: set when this incident must be reported to a regulatory authority. */
  reportable: boolean;
  /** S-02: deadline by which reportable incidents must be filed with the authority. */
  regulatoryDeadline?: string; // ISO date
  /** S-02: when the report was actually filed with the authority. */
  reportedToAuthorityAt?: string; // ISO
  /** S-02: name of the regulatory authority (e.g. "Régie des alcools, des courses et des jeux"). */
  regulatoryAuthority?: string;
  /** OE-29: Escalation level — bumped by severity or manager action. */
  escalationLevel?: 0 | 1 | 2 | 3;
  /** OE-29: StaffId of the security lead assigned when escalated. */
  escalatedToStaffId?: string;
  /** OE-30: Witness accounts — names, contacts, statements. */
  witnesses?: { name: string; contact?: string; statement: string }[];
  /** OE-30: CCTV camera reference and timestamp for verification. */
  cctvReference?: { camera: string; timestamp: string }[];
  /** OE-31: Medical incident checklist fields. */
  medicalChecklist?: { ambulanceCalled: boolean; paramedicsArrivedAt?: string; transportTo?: string; reportFiled: boolean };
  staffInjuryDetails?: {
    staffId: string;
    injuryType: string;
    injuryDescription: string;
    treatmentProvided: string;
    hospitalVisitRequired: boolean;
    workersCompFiled: boolean;
  };
}

/** Append-only follow-up on an Incident — the narrative itself never changes after submit. */
export interface IncidentNote {
  id: string;
  incidentId: string;
  note: string;
  authorStaffId: string;
  authorStaffName: string;
  createdAt: string; // ISO
}

/** SI-08: Pre-filled template for common incident types — speeds up filing during busy nights. */
export interface IncidentTemplate {
  id: string;
  venueId: string;
  type: IncidentType;
  severity: IncidentSeverity;
  /** Pre-filled narrative template with placeholders like {guestName}, {zoneName}. */
  narrativeTemplate: string;
  /** Pre-filled actions-taken template. */
  actionsTakenTemplate: string;
  /** Whether this template is active (shown in the quick-file list). */
  isActive: boolean;
  createdAt: string; // ISO
}

// ---------- Safety: certification tracking (S-04, plan 17) ----------

/** Venue-configurable certification type — seeded with common nightclub-required certs. */
export type CertificationType = "smart-serve" | "first-aid" | "security-guard" | "food-handler" | "crowd-manager";

export const CERTIFICATION_TYPE_LABELS: Record<CertificationType, string> = {
  "smart-serve": "Smart Serve (responsible alcohol service)",
  "first-aid": "First Aid / CPR",
  "security-guard": "Security Guard Licence",
  "food-handler": "Food Handler Certificate",
  "crowd-manager": "Crowd Manager Certification",
};

export interface Certification {
  id: string;
  venueId: string;
  staffId: string;
  type: CertificationType;
  issuedAt: string; // ISO
  expiresAt: string; // ISO
  issuingBody?: string;
  referenceNumber?: string;
  verifiedByStaffId?: string;
  verifiedAt?: string; // ISO
  /** Derived from expiresAt — "active" when not yet expired, "expired" past due, "revoked" by manager. */
  status: "active" | "expired" | "revoked";
}

// ---------- Workforce: time clock, scheduling, tips & commissions (plan 18) ----------

export type EmploymentType = "hourly" | "salaried" | "contractor" | "commission";

/** A recurring weekly shift template — generates dated Shift instances. */
export interface ShiftTemplate {
  id: string;
  venueId: string;
  staffId: string;
  dayOfWeek: number; // 0 = Sunday
  startTime: string; // "22:00"
  endTime: string;
  zoneId: string | null;
  role?: StaffRole;
  active: boolean;
}

export type ShiftStatus = "draft" | "published" | "confirmed" | "in-progress" | "completed" | "no-show" | "cancelled";

/** One dated shift instance for one staff member on one business date. */
export interface Shift {
  id: string;
  venueId: string;
  staffId: string;
  businessDate: string; // bucketed via nightEndHour, never toDateString()
  scheduledStart: string; // "22:00"
  scheduledEnd: string;
  zoneId: string | null;
  role: StaffRole;
  status: ShiftStatus;
  templateId?: string;
  publishedAt?: string; // ISO
  note?: string;
}

/** Append-only — every clock action is a new row; edits supersede, never mutate. */
export interface TimeEntry {
  id: string;
  venueId: string;
  shiftId?: string;
  staffId: string;
  clockInAt: string; // ISO
  clockOutAt?: string;
  breaks: BreakEntry[];
  source: "self" | "manager";
  /** Set when this row supersedes an earlier one — the original is never edited (INV-W3). */
  supersedesId?: string;
  editedByStaffId?: string;
  editReason?: string;
  /** Derived — minutesWorked with breaks subtracted, computed at clock-out. */
  minutesWorked?: number;
}

export interface BreakEntry {
  startedAt: string; // ISO
  endedAt?: string;
  paid: boolean;
}

export type TimeOffStatus = "requested" | "approved" | "denied";

export interface TimeOffRequest {
  id: string;
  venueId: string;
  staffId: string;
  startDate: string; // "YYYY-MM-DD"
  endDate: string;
  reason: string;
  status: TimeOffStatus;
  decidedByStaffId?: string;
  decidedAt?: string; // ISO
}

export type ShiftSwapStatus = "open" | "claimed" | "approved" | "denied" | "withdrawn";

export interface ShiftSwapRequest {
  id: string;
  venueId: string;
  shiftId: string;
  requestedByStaffId: string;
  offeredToStaffId?: string;
  status: ShiftSwapStatus;
  claimedByStaffId?: string;
  decidedByStaffId?: string;
}

export type TipPoolBasis = "hours-weighted" | "equal" | "role-percentage";

export interface TipPoolRule {
  id: string;
  venueId: string;
  name: string;
  basis: TipPoolBasis;
  /** Required when basis === "role-percentage" — percentages per role. */
  rolePercentages?: Record<StaffRole, number>;
  includeRoles: StaffRole[];
  /** Tip retention is illegal in many jurisdictions — surfaced with a warning, not neutral. */
  houseRetentionPct: number;
  active: boolean;
}

export interface TipDistributionLine {
  staffId: string;
  basisValue: number; // hours, weight, or role % — what the share calculation used
  shareCents: number;
}

/** Append-only per business date — computed, never hand-edited. Shares sum exactly to poolCents. */
export interface TipDistribution {
  id: string;
  venueId: string;
  businessDate: string;
  ruleId: string;
  poolCents: number;
  lines: TipDistributionLine[];
  computedAt: string; // ISO
  closedByStaffId: string;
}

export type CommissionBasis = "net-revenue" | "table-minimum" | "per-head" | "per-reservation";

export interface CommissionRule {
  id: string;
  venueId: string;
  staffId?: string;
  appliesToRole?: StaffRole;
  basis: CommissionBasis;
  ratePct?: number;
  flatCents?: number;
  qualifier?: {
    minPartySize?: number;
    channels?: ReservationChannel[];
  };
}

export interface CommissionLine {
  sourceType: "reservation" | "session" | "order";
  sourceId: string;
  basisCents: number;
  earnedCents: number;
}

/** Append-only — approved by a manager, writes an audit entry. */
export interface CommissionStatement {
  id: string;
  venueId: string;
  staffId: string;
  periodStart: string; // ISO
  periodEnd: string;
  lines: CommissionLine[];
  totalCents: number;
  status: "draft" | "approved";
  approvedByStaffId?: string;
}

/** Per-zone coverage rule — min staff by role the manager sees while scheduling. */
export interface ZoneCoverageRule {
  id: string;
  venueId: string;
  zoneId: string;
  role: StaffRole;
  minStaff: number;
}

// ---------- Cost, supply chain & profitability (plan 19) ----------

export interface Supplier {
  id: string;
  venueId: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  accountNumber?: string;
  leadTimeDays: number;
  orderDays: number[]; // allowed ordering days (0=Sun)
  minimumOrderCents?: number;
  notes?: string;
  active: boolean;
}

export interface SupplierItem {
  id: string;
  supplierId: string;
  menuItemId: string;
  supplierSku?: string;
  caseSize?: number;
  caseCostCents?: number;
  unitCostCents?: number; // derived from caseCostCents / caseSize
  lastPriceChangeAt?: string; // ISO
  preferred: boolean;
}

export type PurchaseOrderStatus = "draft" | "submitted" | "partially-received" | "received" | "cancelled";

export interface PriceChange {
  menuItemId: string;
  itemName: string;
  previousUnitCostCents: number;
  newUnitCostCents: number;
  changePercent: number; // signed, e.g. +20 = 20% increase
}

export interface PurchaseOrderLine {
  id: string;
  menuItemId: string;
  qtyOrdered: number;
  qtyReceived: number;
  unitCostCents: number;
  lineTotalCents: number;
}

export interface PurchaseOrder {
  id: string;
  venueId: string;
  supplierId: string;
  code: string; // e.g. "PO-2026-001"
  status: PurchaseOrderStatus;
  expectedAt?: string; // ISO
  submittedAt?: string;
  submittedByStaffId?: string;
  lines: PurchaseOrderLine[];
  subtotalCents: number;
  notes?: string;
}

export type StocktakeScope = "full" | "zone" | "category";
export type StocktakeStatus = "open" | "counting" | "committed" | "cancelled";

export interface StocktakeLine {
  id: string;
  menuItemId: string;
  expectedQty: number; // snapshot at open
  countedQty?: number;
  secondCountQty?: number;
  varianceQty: number; // derived: countedQty - expectedQty
  varianceCents: number; // derived: variance × avgCostCents
  countedByStaffId?: string;
}

export interface Stocktake {
  id: string;
  venueId: string;
  businessDate: string;
  scope: StocktakeScope;
  status: StocktakeStatus;
  startedAt: string; // ISO
  committedAt?: string;
  startedByStaffId: string;
  lines: StocktakeLine[];
  totalVarianceCents: number; // derived
}

export interface EightySixEntry {
  id: string;
  menuItemId: string;
  reason: string;
  byStaffId: string;
  at: string; // ISO
  reinstatedAt?: string;
}

export type ProfitMetric = "pour-cost" | "gross-margin" | "labour-pct" | "comp-pct";

export interface ProfitTarget {
  id: string;
  venueId: string;
  metric: ProfitMetric;
  scope: "venue" | "category";
  categoryId?: string;
  targetValue: number; // e.g. 0.22 for 22% pour cost target
  warnAt: number; // threshold to raise Pulse alert
  direction: "above" | "below"; // above=bad (pour-cost), below=bad (margin)
}

export interface EventCost {
  id: string;
  eventId: string;
  label: string;
  kind: "talent" | "marketing" | "production" | "other";
  amountCents: number;
}

export interface EventPnL {
  eventId: string;
  eventName: string;
  attributedRevenue: number;
  attributedProductCost: number;
  attributedLabourCost: number;
  eventCosts: EventCost[];
  totalCosts: number;
  contribution: number; // revenue - product - labour - event costs
}

// ---------- Remaining Phase 3 operational feature types ----------

/** OE-01: Order SLA escalation path — triggers when an order exceeds its deadline. */
export type OrderSlaEscalation = "none" | "warned" | "manager-alerted" | "auto-unclaimed";

/** OE-05: Service checklist item on a bottle order — ice, glasses, mixers, garnish. */
export interface OrderServiceChecklist {
  ice: boolean;
  glasses: boolean;
  mixers: boolean;
  garnish: boolean;
}

/** OE-08: Session reopen window — configurable minutes after close during which a session can be reopened. */
export interface SessionReopenWindow {
  reopenMinutes: number; // how long after close the session can be reopened
  maxReopens: number; // max number of reopens per session
}

/** OE-19: Event run sheet — timeline of key moments for a night's event. */
export interface EventRunSheetEntry {
  time: string; // e.g. "22:00"
  label: string; // e.g. "Doors open"
  description?: string;
}

/** OE-27: Pre-shift briefing — manager-written notes for staff starting a shift. */
export interface ShiftBriefing {
  id: string;
  venueId: string;
  businessDate: string;
  message: string;
  sentByStaffId: string;
  sentByStaffName: string;
  sentAt: string;
}

/** OE-32: Post-incident action item — assignable task from an incident review. */
export interface IncidentActionItem {
  id: string;
  incidentId: string;
  description: string;
  assignedToStaffId?: string;
  status: "pending" | "in-progress" | "completed";
  createdAt: string;
  completedAt?: string;
}

/** OE-33: Supplier performance metrics — on-time rate, fill rate, quality per supplier. */
export interface SupplierPerformanceMetrics {
  supplierId: string;
  onTimeRate: number; // 0–100%
  fillRate: number; // 0–100%
  qualityRating?: number; // 1–5
  lastEvaluatedAt: string;
}

/** OE-35: Pre/post-service inventory checklist entry. */
export interface InventoryChecklistEntry {
  id: string;
  menuItemId: string;
  itemName: string;
  expectedCount: number;
  actualCount?: number;
  checked: boolean;
  checkedByStaffId?: string;
  checkedAt?: string;
}

/** OE-35: Inventory checklist session (pre-service or post-service). */
export interface InventoryChecklist {
  id: string;
  venueId: string;
  businessDate: string;
  type: "pre-service" | "post-service";
  status: "open" | "completed";
  lines: InventoryChecklistEntry[];
  startedAt: string;
  completedAt?: string;
}

/** CRM-06: Guest referral tracking — attribution chain for referral bonus basis. */
export interface GuestReferral {
  id: string;
  referrerProfileId: string;
  referredProfileId: string;
  source: string; // "guest", "promoter", "staff"
  status: "pending" | "converted" | "expired";
  createdAt: string;
  convertedAt?: string;
}

/** RV-01: Time-slotted reservation configuration. */
export type ReservationTimeSlot = "early" | "late" | "any";

/** OE-02: Drink preparation ETA — queue position × average prep time. */
export interface DrinkEta {
  orderId: string;
  estimatedMinutes: number;
  queuePosition: number;
  startedAt?: string;
}

/** RV-04: Cover price schedule — time/event/category-based pricing rules at the door. */
export interface CoverPriceRule {
  id: string;
  venueId: string;
  label: string;
  /** Which days of the week (0=Sun, 6=Sat). */
  daysOfWeek: number[];
  /** Start time for this rate (HH:MM). */
  startTime: string;
  /** End time for this rate (HH:MM). */
  endTime: string;
  /** Cover price in cents for walk-ins during this window. */
  coverCents: number;
  /** If set, only applies to this event. */
  eventId?: string;
  active: boolean;
}

/** OE-21: "Guest of" grouping — +1s attributed to a named main guest on a guest list. */
export interface GuestOfGroup {
  id: string;
  eventId: string;
  mainGuestName: string;
  mainGuestProfileId?: string;
  plusOnes: { name: string; profileId?: string }[];
  promoterId?: string;
}

/** OE-28: Staff performance metrics per shift. */
export interface StaffShiftMetrics {
  staffId: string;
  businessDate: string;
  ordersFulfilled: number;
  revenueCents: number;
  avgMinutesToDeliver: number;
  compCount: number;
  compCents: number;
}

/** CRM-05: Visit cadence analysis result for a guest. */
export interface VisitCadenceAnalysis {
  profileId: string;
  avgDaysBetweenVisits: number;
  last30Days: number;
  last90Days: number;
  isDormant: boolean; // no visits in 90 days
  streak: number; // consecutive weeks with a visit
}

/** RV-08: Split-bill — per-item assignment to sub-totals for sequential settlement. */
export interface SplitBillAssignment {
  sessionId: string;
  splits: { label: string; orderItemIds: string[]; subTotalCents: number; settled: boolean }[];
}

/** RV-21: Bar tab — non-table session created by bartender, profile-linked. */
export interface BarTab {
  id: string;
  venueId: string;
  guestProfileId?: string;
  guestName: string;
  status: "open" | "closed";
  openedByStaffId: string;
  openedByStaffName: string;
  openedAt: string;
  closedAt?: string;
}

/** OE-20: Event-specific menu — scoped items/packages to an event window. */
export interface EventMenuOverride {
  eventId: string;
  menuItemIds: string[];
  packageIds: string[];
  priceOverrides: Record<string, number>; // menuItemId → cents
}

// ---------- Phase 4: Analytics Depth (AI-01 through AI-14) ----------

/** AI-01: Night-over-night comparison — tonight vs a reference night (e.g. last Saturday, avg Saturday). */
export interface NightComparison {
  /** Label for the comparison (e.g. "vs last Saturday", "vs avg Saturday"). */
  referenceLabel: string;
  /** Tonight's metric values (live or historical). */
  current: { revenue: number; orders: number; avgOrderValue: number; covers: number };
  /** Reference night's metric values. */
  reference: { revenue: number; orders: number; avgOrderValue: number; covers: number };
  /** Percentage deltas (can be negative). */
  deltas: { revenuePct: number; ordersPct: number; avgOrderValuePct: number; coversPct: number };
}

/** AI-02: Forecast / projection — current pace extrapolated to end-of-night. */
export interface NightForecast {
  /** The current (partial) night metrics, computed so far. */
  current: { revenue: number; orders: number; covers: number };
  /** How many hours into the night (e.g. 3.5 out of 8). */
  hoursElapsed: number;
  hoursTotal: number;
  /** Projected end-of-night numbers. */
  projected: { revenue: number; orders: number; covers: number };
  /** The pace multiplier (totalHours / elapsedHours), capped at a plausible ceiling. */
  paceMultiplier: number;
  /** 0 = on pace, >0 = ahead, <0 = behind. */
  variancePct: number;
  /** Event boosting revenue (if any active event contributes uplift). */
  eventBoost?: { eventName: string; estimatedUpliftCents: number };
}

/** AI-03: Per-hour breakdown — revenue, orders, admissions by operational hour. */
export interface PerHourBucket {
  hour: string; // e.g. "22:00"
  revenue: number;
  orders: number;
  admissions: number;
  exits: number;
  occupancy: number;
  peakFlag?: boolean;
}

export interface PerHourAnalytics {
  buckets: PerHourBucket[];
  peakHour: string;
  peakRevenue: number;
  peakOccupancy: number;
  legalCapacity: number;
}

/** AI-04: Door-to-table conversion funnel — how admissions flow through to revenue. */
export interface DoorToTableFunnel {
  admissions: number;
  sessionsCreated: number;
  menusOpened: number;
  ordersPlaced: number;
  ordersDelivered: number;
  /** Step conversion rates (each step / admissions). */
  rates: { sessionRate: number; menuOpenRate: number; orderRate: number; deliveryRate: number };
  /** Where the biggest drop-off happens. */
  biggestDropStep: string;
  biggestDropPct: number;
}

/** AI-05: Table-turn analytics — occupancy duration and seatings per night. */
export interface TableTurnEntry {
  tableId: string;
  tableCode: string;
  zoneId: string;
  zoneName: string;
  seatings: number;
  avgOccupancyMinutes: number;
  totalOccupancyMinutes: number;
  /** Revenue per seating — the table's contribution per occupied slot. */
  revenuePerSeating: number;
  /** Percentage of the night this table was occupied. */
  occupancyRate: number;
}

export interface TableTurnAnalytics {
  turns: TableTurnEntry[];
  avgTurnsPerTable: number;
  avgOccupancyMinutes: number;
  totalSeatings: number;
  fastestTurn: { tableCode: string; minutes: number };
  slowestTurn: { tableCode: string; minutes: number };
}

/** AI-06: Order SLA / time-to-serve analytics. */
export interface OrderSlaBucket {
  label: string; // e.g. "0-5 min", "5-10 min", "10-15 min", "15+ min"
  minMinutes: number;
  maxMinutes: number | null;
  count: number;
}

export interface OrderSlaAnalytics {
  avgAcceptMinutes: number;
  avgPrepMinutes: number;
  avgTotalMinutes: number;
  p50Minutes: number;
  p95Minutes: number;
  p99Minutes: number;
  /** Distribution buckets for total time-to-serve. */
  distribution: OrderSlaBucket[];
  byZone: { zoneId: string; zoneName: string; avgMinutes: number; count: number }[];
  byStaff: { staffId: string; staffName: string; role: StaffRole; avgMinutes: number; count: number }[];
  slaBreachCount: number;
  slaBreachRate: number;
  autoEscalationCount: number;
}

/** AI-07: Comp/void ratio monitoring — per-staff with threshold alerting. */
export interface CompVoidRatioEntry {
  staffId: string;
  staffName: string;
  role: StaffRole;
  compCount: number;
  voidCount: number;
  compCents: number;
  voidCents: number;
  compRate: number; // compCents / grossCents
  voidRate: number; // voidCents / grossCents
  /** Whether this staff member exceeds the configured threshold. */
  flagged: boolean;
}

export interface CompVoidRatioAnalytics {
  entries: CompVoidRatioEntry[];
  /** Configurable threshold above which a staff member is flagged. */
  compRateThreshold: number;
  voidRateThreshold: number;
  flaggedCount: number;
}

/** AI-08: Report CSV export & email delivery. (CSV rendering exists in report-csv.ts — this type
 *  represents the export job and delivery status.) */
export interface ReportExport {
  id: string;
  reportName: string;
  metrics: ReportMetric[];
  rangeFrom: string;
  rangeTo: string;
  format: "csv";
  /** Status of the export job. */
  status: "pending" | "generated" | "emailed" | "failed";
  /** CSV content (in-memory for demo; in real life, a signed S3 URL). */
  csvContent?: string;
  /** When email sent (ISO). */
  emailedAt?: string;
  recipient?: string;
  createdAt: string;
}

/** AI-09: Promoter performance report — fill rate, check-in rate, spend, commission. */
export interface PromoterPerformanceReport {
  promoterId: string;
  promoterName: string;
  /** Reservations created in the range. */
  reservationsCreated: number;
  /** Reservations confirmed (approved by venue). */
  reservationsConfirmed: number;
  /** Guests who actually checked in. */
  checkIns: number;
  /** Show-up rate (check-ins / confirmed). */
  showUpRate: number;
  /** Fill rate (confirmed / created). */
  fillRate: number;
  /** Attributed revenue from seated reservations. */
  attributedRevenue: number;
  /** Commission earned (if commission rate is set). */
  commissionCents: number;
  /** Average spend per checked-in guest. */
  avgSpendPerGuest: number;
  /** Guest list count for promoter-hosted events. */
  guestListCount: number;
  /** Guest list conversion (seated ÷ guest list invites). */
  guestListConversion: number;
}

/** AI-10: Security incident pattern report — by zone, time, night, staff presence. */
export interface IncidentPatternEntry {
  zoneId?: string;
  zoneName?: string;
  hour?: string;
  dayOfWeek?: number; // 0=Sun
  severity: "low" | "medium" | "high";
  count: number;
}

export interface IncidentPatternReport {
  byZone: { zoneId: string; zoneName: string; low: number; medium: number; high: number; total: number }[];
  byHour: { hour: string; count: number; severity: "low" | "medium" | "high" }[];
  byDayOfWeek: { day: number; dayName: string; count: number }[];
  /** Hotspots — the zone+hour combinations with the most incidents. */
  hotspots: { zoneName: string; hour: string; count: number }[];
  totalIncidents: number;
}

/** AI-11: Guest retention report — repeat rate, churn, new vs returning. */
export interface GuestRetentionMetrics {
  newGuests: number;
  returningGuests: number;
  totalGuests: number;
  /** Repeat rate: returning / total. */
  repeatRate: number;
  /** Churn rate: guests who visited last period but not this one. */
  churnRate: number;
  /** Average visits per guest in the range. */
  avgVisitsPerGuest: number;
  /** Guests with 3+ visits (power users). */
  powerUsers: number;
  /** VIP retention — percentage of VIPs who returned this period. */
  vipRetentionRate: number;
  /** Average days between visits for returning guests. */
  avgDaysBetweenVisits: number;
}

/** AI-12: Bottle service utilization — by brand, zone, time; presentation frequency. */
export interface BottleServiceEntry {
  menuItemId: string;
  itemName: string;
  categoryId: string;
  categoryName: string;
  presentations: number; // count of sparkler/presentation events
  bottlesSold: number;
  revenue: number;
  /** Average revenue per bottle presentation. */
  avgRevenuePerPresentation: number;
  /** Zone breakdown. */
  zoneBreakdown: { zoneId: string; zoneName: string; bottles: number; revenue: number }[];
  /** Percentage of total bottle revenue this item represents. */
  shareOfBottleRevenue: number;
}

export interface BottleServiceAnalytics {
  entries: BottleServiceEntry[];
  totalBottleRevenue: number;
  totalPresentations: number;
  totalBottlesSold: number;
  avgBottleRevenue: number;
  /** Peak hour for bottle presentations. */
  peakHour: string;
}

/** AI-13: Capacity utilization — peak occupancy, entry/exit rates, avg stay. */
export interface CapacityUtilizationBucket {
  hour: string;
  occupancy: number; // headcount
  utilizationPct: number; // occupancy / legalCapacity
  entries: number;
  exits: number;
}

export interface CapacityUtilizationAnalytics {
  buckets: CapacityUtilizationBucket[];
  legalCapacity: number;
  peakOccupancy: number;
  peakHour: string;
  peakUtilizationPct: number;
  avgOccupancy: number;
  avgStayMinutes: number;
  totalEntries: number;
  totalExits: number;
  /** Whether legal capacity was ever exceeded. */
  exceededLegalCapacity: boolean;
}

/** AI-14: Night summary auto-generation — one-page executive summary at venue close. */
export interface NightSummary {
  businessDate: string;
  generatedAt: string;
  /** Revenue snapshot. */
  revenue: { total: number; deltaVsAvgPct: number; deltaVsLastWeekPct: number };
  orders: { total: number; avgValue: number; topItem: string };
  covers: { total: number; seated: number; noShowCount: number };
  staff: { onDuty: number; topPerformer: string; topPerformerRevenue: number };
  incidents: { total: number; highSeverity: number };
  inventory: { topSoldItem: string; soldOutItems: string[] };
  /** Single-paragraph executive summary — the "what happened tonight" narrative. */
  executiveSummary: string;
  /** Action items flagged for the next manager on duty. */
  actionItems: string[];
  /** Whether this summary has been emailed. */
  emailed: boolean;
}

// ---------- Phase 4: Automations (AM-01 through AM-13) ----------

/** Each automation the venue can enable/configure. */
export type AutomationCode =
  | "auto-release-reservations"    // AM-01
  | "auto-generate-po"             // AM-02
  | "auto-escalate-orders"         // AM-03
  | "auto-detect-duplicates"       // AM-04
  | "auto-vip-tier-upgrade"        // AM-05
  | "auto-event-pricing"           // AM-06
  | "auto-close-event"             // AM-07
  | "auto-remove-86"               // AM-08
  | "auto-pour-cost"               // AM-09
  | "auto-flag-variance"           // AM-10
  | "auto-notify-vip-arrival"      // AM-11
  | "auto-flag-dormant-vip"        // AM-12
  | "auto-suggest-table"           // AM-13
  | "auto-close-abandoned-sessions";

export interface AutomationRule {
  id: string;
  code: AutomationCode;
  label: string;
  description: string;
  /** Whether the automation is enabled for this venue. */
  enabled: boolean;
  /** Category for grouping in the UI. */
  category: "reservations" | "orders" | "inventory" | "vip" | "events" | "reports";
  /** Configurable threshold values per-automation (JSON-typed for demo flexibility). */
  config: Record<string, string | number | boolean>;
  /** When this rule was last triggered (ISO). */
  lastTriggeredAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** A record of an automation having run — the execution log. */
export interface AutomationExecution {
  id: string;
  ruleId: string;
  code: AutomationCode;
  triggeredAt: string;
  /** What happened — a human-readable summary. */
  result: string;
  /** Whether the action was applied (some are advisory/suggestive). */
  actionApplied: boolean;
  /** Relevant entity IDs affected (e.g. order IDs, guest IDs). */
  affectedEntityIds: string[];
  /** Duration in milliseconds the automation took to run. */
  durationMs: number;
}

// ---------- Realtime: revenue pace & attention acknowledgments ----------

export interface RevenuePace {
  current: number;
  lastWeekSameTime: number;
  pacePercent: number;
  projected: number;
}

export interface AttentionAcknowledgment {
  id: string;
  attentionItemId: string;
  acknowledgedByStaffId: string;
  acknowledgedByStaffName: string;
  acknowledgedAt: string;
  snoozedUntil?: string;
}

// ---------- Door: coat check & refusals ----------

export interface CoatCheckClaim {
  id: string;
  ticketId?: string;
  claimType: "lost-ticket" | "lost-item";
  description: string;
  reportedByStaffName: string;
  reportedAt: string;
  resolution?: string;
  resolvedAt?: string;
  resolvedByStaffId?: string;
}

export interface DoorRefusal {
  id: string;
  venueId: string;
  businessDate: string;
  reason: string;
  description: string;
  partySize: number;
  refusedByStaffId: string;
  refusedByStaffName: string;
  timestamp: string;
}

// ---------- Guest sessions: notes & VIP tiers ----------

export interface SessionNote {
  id: string;
  sessionId: string;
  note: string;
  createdByStaffId: string;
  createdByStaffName: string;
  createdAt: string;
}

export interface VipTierBenefit {
  id: string;
  venueId: string;
  tier: GuestVipTier;
  benefit: string;
  category: string;
  sortOrder: number;
  active: boolean;
}

// ---------- Orders: remakes & walkouts ----------

export interface OrderRemake {
  id: string;
  oldOrderId: string;
  newOrderId: string;
  reason: string;
  remadeByStaffId: string;
  remadeByStaffName: string;
  remadeAt: string;
}

export interface WalkoutRecord {
  id: string;
  sessionId: string;
  tableCode: string;
  description: string;
  reportedByStaffId: string;
  reportedByStaffName: string;
  reportedAt: string;
}

// ---------- Workforce: assignments & handoffs ----------

export interface StaffTableAssignment {
  id: string;
  venueId: string;
  staffId: string;
  tableIds: string[];
  zoneId: string;
  shiftId?: string;
  assignedAt: string;
}

export interface ShiftHandoff {
  id: string;
  venueId: string;
  businessDate: string;
  fromStaffId: string;
  fromStaffName: string;
  toStaffId?: string;
  toStaffName?: string;
  openIncidents: string[];
  vipNotes: string;
  inventoryAlerts: string;
  specialInstructions: string;
  generatedAt: string;
  acknowledgedByStaffId?: string;
  acknowledgedByStaffName?: string;
  acknowledgedAt?: string;
}

// ---------- Venue: checklists ----------

export type ChecklistType = "opening" | "closing";

export interface ChecklistTemplateItem {
  id: string;
  label: string;
  required: boolean;
}

export interface ChecklistTemplate {
  id: string;
  venueId: string;
  name: string;
  type: ChecklistType;
  active: boolean;
  items: ChecklistTemplateItem[];
}

export interface ChecklistRunItem {
  templateItemId: string;
  label: string;
  checked: boolean;
  checkedAt?: string;
  checkedByStaffId?: string;
  note?: string;
}

export interface ChecklistRun {
  id: string;
  venueId: string;
  templateId: string;
  templateName: string;
  type: ChecklistType;
  businessDate: string;
  status: "in-progress" | "completed" | "skipped";
  items: ChecklistRunItem[];
  startedAt: string;
  startedByStaffId: string;
  startedByStaffName: string;
  completedAt?: string;
  completedByStaffId?: string;
  completedByStaffName?: string;
}
