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
}

export interface Zone {
  id: string;
  venueId: string;
  name: string;
  description: string;
  color: string; // tailwind-friendly hue token, e.g. "violet"
  tableCount: number;
}

export type TableStatus = "open" | "occupied" | "reserved" | "closed";

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
}

// ---------- Staff ----------

export type StaffRole = "manager" | "host" | "bartender" | "runner" | "security" | "promoter";

/** Roles a manager can assign when creating/editing staff ("security" is legacy). */
export const ASSIGNABLE_ROLES = ["manager", "host", "bartender", "runner", "promoter"] as const;

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
  isOnShift: boolean;
  avatarInitials: string;
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
}

// ---------- Inventory ----------

export type StockMovementType = "restock" | "sale" | "adjustment";

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
  | "closed";

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
}

export type SettlementMethod = "terminal" | "cash" | "house";

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
  // TODO(backend): becomes a real column — happy-hour attribution snapshot.
  happyHourRuleId?: string;
  happyHourCents?: number;
}

// ---------- Help requests ----------

export type HelpRequestType = "call-waiter" | "refill-ice" | "clean-table" | "security" | "bill";
export type HelpRequestStatus = "open" | "acknowledged" | "resolved";

export interface HelpRequest {
  id: string;
  sessionId: string;
  tableCode: string;
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
export type AttentionItemType = "order-overdue" | "help-open" | "table-closeout";

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
}

export interface HistoricalAnalytics {
  from: string;
  to: string;
  days: number;
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
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
  | "multi-venue";

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
  | "completed";

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
  // TODO(backend): FK to staff_profiles; set when a promoter creates the reservation or assigned by manager
  promoterId?: string;
  createdAt: string; // ISO
}

// ---------- Events & promotions ----------

export type EventStatus = "draft" | "published" | "live" | "ended";

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
}

/** Event-scoped attendee name — not a stored customer/profile. */
export interface EventGuest {
  id: string;
  eventId: string;
  name: string;
  partySize: number;
  status: "invited" | "confirmed" | "checked-in";
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
