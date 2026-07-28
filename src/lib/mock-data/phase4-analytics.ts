import type {
  NightComparison,
  NightForecast,
  PerHourAnalytics,
  DoorToTableFunnel,
  TableTurnAnalytics,
  OrderSlaAnalytics,
  CompVoidRatioAnalytics,
  PromoterPerformanceReport,
  IncidentPatternReport,
  GuestRetentionMetrics,
  BottleServiceAnalytics,
  CapacityUtilizationAnalytics,
  NightSummary,
} from "@/lib/types";

// ---------- AI-01: Night-over-night comparison ----------
export const mockNightComparison: NightComparison = {
  referenceLabel: "vs last Saturday",
  current: { revenue: 12420, orders: 143, avgOrderValue: 86.9, covers: 44 },
  reference: { revenue: 14300, orders: 171, avgOrderValue: 83.6, covers: 51 },
  deltas: { revenuePct: -13.1, ordersPct: -16.4, avgOrderValuePct: 3.9, coversPct: -13.7 },
};

// ---------- AI-02: Forecast / projection ----------
export const mockNightForecast: NightForecast = {
  current: { revenue: 8200, orders: 96, covers: 30 },
  hoursElapsed: 5,
  hoursTotal: 8,
  projected: { revenue: 13120, orders: 154, covers: 48 },
  paceMultiplier: 1.6,
  variancePct: 5.6,
  eventBoost: { eventName: "Latin Night", estimatedUpliftCents: 210000 },
};

// ---------- AI-03: Per-hour breakdown ----------
export const mockPerHourAnalytics: PerHourAnalytics = {
  buckets: [
    { hour: "22:00", revenue: 840, orders: 14, admissions: 18, exits: 2, occupancy: 16, peakFlag: false },
    { hour: "23:00", revenue: 1580, orders: 22, admissions: 28, exits: 5, occupancy: 39, peakFlag: false },
    { hour: "00:00", revenue: 2420, orders: 29, admissions: 22, exits: 8, occupancy: 53, peakFlag: true },
    { hour: "01:00", revenue: 2900, orders: 31, admissions: 14, exits: 12, occupancy: 55, peakFlag: true },
    { hour: "02:00", revenue: 2610, orders: 26, admissions: 8, exits: 18, occupancy: 45, peakFlag: false },
    { hour: "03:00", revenue: 1510, orders: 15, admissions: 2, exits: 22, occupancy: 25, peakFlag: false },
    { hour: "04:00", revenue: 560, orders: 6, admissions: 0, exits: 20, occupancy: 5, peakFlag: false },
  ],
  peakHour: "01:00",
  peakRevenue: 2900,
  peakOccupancy: 55,
  legalCapacity: 120,
};

// ---------- AI-04: Door-to-table conversion funnel ----------
export const mockDoorToTableFunnel: DoorToTableFunnel = {
  admissions: 92,
  sessionsCreated: 71,
  menusOpened: 68,
  ordersPlaced: 143,
  ordersDelivered: 132,
  rates: { sessionRate: 0.77, menuOpenRate: 0.74, orderRate: 0.62, deliveryRate: 0.57 },
  biggestDropStep: "sessions → menus",
  biggestDropPct: 0.23,
};

// ---------- AI-05: Table-turn analytics ----------
export const mockTableTurnAnalytics: TableTurnAnalytics = {
  turns: [
    { tableId: "t-vip-01", tableCode: "VIP-01", zoneId: "zone-vip", zoneName: "VIP Mezzanine", seatings: 2, avgOccupancyMinutes: 185, totalOccupancyMinutes: 370, revenuePerSeating: 1950, occupancyRate: 0.77 },
    { tableId: "t-vip-02", tableCode: "VIP-02", zoneId: "zone-vip", zoneName: "VIP Mezzanine", seatings: 2, avgOccupancyMinutes: 210, totalOccupancyMinutes: 420, revenuePerSeating: 2250, occupancyRate: 0.88 },
    { tableId: "t-vip-03", tableCode: "VIP-03", zoneId: "zone-vip", zoneName: "VIP Mezzanine", seatings: 1, avgOccupancyMinutes: 260, totalOccupancyMinutes: 260, revenuePerSeating: 1800, occupancyRate: 0.54 },
    { tableId: "t-dance-01", tableCode: "DNC-01", zoneId: "zone-dance", zoneName: "Main Floor", seatings: 3, avgOccupancyMinutes: 140, totalOccupancyMinutes: 420, revenuePerSeating: 420, occupancyRate: 0.88 },
    { tableId: "t-dance-02", tableCode: "DNC-02", zoneId: "zone-dance", zoneName: "Main Floor", seatings: 3, avgOccupancyMinutes: 130, totalOccupancyMinutes: 390, revenuePerSeating: 380, occupancyRate: 0.81 },
    { tableId: "t-ter-01", tableCode: "TER-01", zoneId: "zone-terrace", zoneName: "Terrace", seatings: 2, avgOccupancyMinutes: 170, totalOccupancyMinutes: 340, revenuePerSeating: 420, occupancyRate: 0.71 },
    { tableId: "t-ter-02", tableCode: "TER-02", zoneId: "zone-terrace", zoneName: "Terrace", seatings: 1, avgOccupancyMinutes: 180, totalOccupancyMinutes: 180, revenuePerSeating: 340, occupancyRate: 0.38 },
    { tableId: "t-bar-01", tableCode: "BAR-01", zoneId: "zone-bar", zoneName: "Back Bar", seatings: 4, avgOccupancyMinutes: 95, totalOccupancyMinutes: 380, revenuePerSeating: 215, occupancyRate: 0.79 },
  ],
  avgTurnsPerTable: 2.25,
  avgOccupancyMinutes: 171,
  totalSeatings: 18,
  fastestTurn: { tableCode: "BAR-01", minutes: 95 },
  slowestTurn: { tableCode: "VIP-03", minutes: 260 },
};

// ---------- AI-06: Order SLA / time-to-serve analytics ----------
export const mockOrderSlaAnalytics: OrderSlaAnalytics = {
  avgAcceptMinutes: 1.4,
  avgPrepMinutes: 5.8,
  avgTotalMinutes: 7.2,
  p50Minutes: 6.4,
  p95Minutes: 14.1,
  p99Minutes: 18.7,
  distribution: [
    { label: "0-5 min", minMinutes: 0, maxMinutes: 5, count: 42 },
    { label: "5-10 min", minMinutes: 5, maxMinutes: 10, count: 58 },
    { label: "10-15 min", minMinutes: 10, maxMinutes: 15, count: 24 },
    { label: "15+ min", minMinutes: 15, maxMinutes: null, count: 8 },
  ],
  byZone: [
    { zoneId: "zone-vip", zoneName: "VIP Mezzanine", avgMinutes: 5.8, count: 38 },
    { zoneId: "zone-dance", zoneName: "Main Floor", avgMinutes: 7.4, count: 52 },
    { zoneId: "zone-terrace", zoneName: "Terrace", avgMinutes: 9.2, count: 28 },
    { zoneId: "zone-bar", zoneName: "Back Bar", avgMinutes: 6.1, count: 14 },
  ],
  byStaff: [
    { staffId: "st-sofia", staffName: "Sofia Lévesque", role: "bartender", avgMinutes: 6.9, count: 34 },
    { staffId: "st-theo", staffName: "Théo Tremblay", role: "bartender", avgMinutes: 8.4, count: 26 },
    { staffId: "st-lucas", staffName: "Lucas Gagné", role: "host", avgMinutes: 7.4, count: 16 },
  ],
  slaBreachCount: 8,
  slaBreachRate: 0.061,
  autoEscalationCount: 2,
};

// ---------- AI-07: Comp/void ratio monitoring ----------
export const mockCompVoidRatioAnalytics: CompVoidRatioAnalytics = {
  entries: [
    { staffId: "st-sofia", staffName: "Sofia Lévesque", role: "bartender", compCount: 2, voidCount: 1, compCents: 3400, voidCents: 850, compRate: 0.012, voidRate: 0.003, flagged: false },
    { staffId: "st-theo", staffName: "Théo Tremblay", role: "bartender", compCount: 5, voidCount: 3, compCents: 12800, voidCents: 4200, compRate: 0.048, voidRate: 0.016, flagged: true },
    { staffId: "st-lucas", staffName: "Lucas Gagné", role: "host", compCount: 1, voidCount: 0, compCents: 1200, voidCents: 0, compRate: 0.008, voidRate: 0, flagged: false },
  ],
  compRateThreshold: 0.03,
  voidRateThreshold: 0.01,
  flaggedCount: 1,
};

// ---------- AI-09: Promoter performance report ----------
export const mockPromoterPerformanceReport: PromoterPerformanceReport[] = [
  { promoterId: "st-julien", promoterName: "Julien Dubois", reservationsCreated: 8, reservationsConfirmed: 6, checkIns: 5, showUpRate: 0.83, fillRate: 0.75, attributedRevenue: 2400, commissionCents: 24000, avgSpendPerGuest: 133.33, guestListCount: 22, guestListConversion: 0.82 },
  { promoterId: "st-chloe", promoterName: "Chloé Mercier", reservationsCreated: 4, reservationsConfirmed: 3, checkIns: 3, showUpRate: 1.0, fillRate: 0.75, attributedRevenue: 5800, commissionCents: 58000, avgSpendPerGuest: 223.08, guestListCount: 35, guestListConversion: 0.74 },
];

// ---------- AI-10: Security incident pattern report ----------
export const mockIncidentPatternReport: IncidentPatternReport = {
  byZone: [
    { zoneId: "zone-vip", zoneName: "VIP Mezzanine", low: 2, medium: 1, high: 0, total: 3 },
    { zoneId: "zone-dance", zoneName: "Main Floor", low: 4, medium: 3, high: 1, total: 8 },
    { zoneId: "zone-terrace", zoneName: "Terrace", low: 1, medium: 0, high: 0, total: 1 },
    { zoneId: "zone-bar", zoneName: "Back Bar", low: 2, medium: 1, high: 0, total: 3 },
  ],
  byHour: [
    { hour: "22:00", count: 1, severity: "low" },
    { hour: "23:00", count: 2, severity: "low" },
    { hour: "00:00", count: 3, severity: "medium" },
    { hour: "01:00", count: 5, severity: "medium" },
    { hour: "02:00", count: 3, severity: "high" },
    { hour: "03:00", count: 1, severity: "medium" },
  ],
  byDayOfWeek: [
    { day: 4, dayName: "Thursday", count: 3 },
    { day: 5, dayName: "Friday", count: 5 },
    { day: 6, dayName: "Saturday", count: 7 },
    { day: 0, dayName: "Sunday", count: 0 },
  ],
  hotspots: [
    { zoneName: "Main Floor", hour: "01:00", count: 4 },
    { zoneName: "Main Floor", hour: "02:00", count: 2 },
    { zoneName: "VIP Mezzanine", hour: "02:00", count: 1 },
    { zoneName: "Back Bar", hour: "00:00", count: 1 },
  ],
  totalIncidents: 15,
};

// ---------- AI-11: Guest retention metrics ----------
export const mockGuestRetentionMetrics: GuestRetentionMetrics = {
  newGuests: 42,
  returningGuests: 50,
  totalGuests: 92,
  repeatRate: 0.54,
  churnRate: 0.18,
  avgVisitsPerGuest: 2.1,
  powerUsers: 14,
  vipRetentionRate: 0.82,
  avgDaysBetweenVisits: 11.4,
};

// ---------- AI-12: Bottle service utilization ----------
export const mockBottleServiceAnalytics: BottleServiceAnalytics = {
  entries: [
    { menuItemId: "mi-ace", itemName: "Ace of Spades Brut Gold", categoryId: "cat-champagne", categoryName: "Champagne", presentations: 4, bottlesSold: 7, revenue: 3500, avgRevenuePerPresentation: 875, zoneBreakdown: [{ zoneId: "zone-vip", zoneName: "VIP Mezzanine", bottles: 7, revenue: 3500 }], shareOfBottleRevenue: 0.42 },
    { menuItemId: "mi-dom", itemName: "Dom Pérignon Vintage", categoryId: "cat-champagne", categoryName: "Champagne", presentations: 3, bottlesSold: 8, revenue: 2560, avgRevenuePerPresentation: 853, zoneBreakdown: [{ zoneId: "zone-vip", zoneName: "VIP Mezzanine", bottles: 6, revenue: 1920 }, { zoneId: "zone-dance", zoneName: "Main Floor", bottles: 2, revenue: 640 }], shareOfBottleRevenue: 0.31 },
    { menuItemId: "mi-don", itemName: "Don Julio 1942", categoryId: "cat-tequila", categoryName: "Tequila", presentations: 2, bottlesSold: 6, revenue: 2040, avgRevenuePerPresentation: 1020, zoneBreakdown: [{ zoneId: "zone-vip", zoneName: "VIP Mezzanine", bottles: 4, revenue: 1360 }, { zoneId: "zone-terrace", zoneName: "Terrace", bottles: 2, revenue: 680 }], shareOfBottleRevenue: 0.24 },
    { menuItemId: "mi-cognac-xo", itemName: "Hennessy XO", categoryId: "cat-cognac", categoryName: "Cognac", presentations: 1, bottlesSold: 2, revenue: 320, avgRevenuePerPresentation: 320, zoneBreakdown: [{ zoneId: "zone-vip", zoneName: "VIP Mezzanine", bottles: 2, revenue: 320 }], shareOfBottleRevenue: 0.04 },
  ],
  totalBottleRevenue: 8420,
  totalPresentations: 10,
  totalBottlesSold: 23,
  avgBottleRevenue: 366,
  peakHour: "01:00",
};

// ---------- AI-13: Capacity utilization ----------
export const mockCapacityUtilizationAnalytics: CapacityUtilizationAnalytics = {
  buckets: [
    { hour: "22:00", occupancy: 16, utilizationPct: 0.13, entries: 18, exits: 2 },
    { hour: "23:00", occupancy: 39, utilizationPct: 0.33, entries: 28, exits: 5 },
    { hour: "00:00", occupancy: 53, utilizationPct: 0.44, entries: 22, exits: 8 },
    { hour: "01:00", occupancy: 55, utilizationPct: 0.46, entries: 14, exits: 12 },
    { hour: "02:00", occupancy: 45, utilizationPct: 0.38, entries: 8, exits: 18 },
    { hour: "03:00", occupancy: 25, utilizationPct: 0.21, entries: 2, exits: 22 },
    { hour: "04:00", occupancy: 5, utilizationPct: 0.04, entries: 0, exits: 20 },
  ],
  legalCapacity: 120,
  peakOccupancy: 55,
  peakHour: "01:00",
  peakUtilizationPct: 0.46,
  avgOccupancy: 34,
  avgStayMinutes: 168,
  totalEntries: 92,
  totalExits: 87,
  exceededLegalCapacity: false,
};

// ---------- AI-14: Night summary ----------
export const mockNightSummary: NightSummary = {
  businessDate: "2026-07-27",
  generatedAt: "2026-07-28T04:15:00Z",
  revenue: { total: 12420, deltaVsAvgPct: 8.2, deltaVsLastWeekPct: -6.4 },
  orders: { total: 143, avgValue: 86.9, topItem: "Ace of Spades Brut Gold" },
  covers: { total: 92, seated: 44, noShowCount: 2 },
  staff: { onDuty: 8, topPerformer: "Sofia Lévesque", topPerformerRevenue: 2900 },
  incidents: { total: 2, highSeverity: 0 },
  inventory: { topSoldItem: "Washers (mixers)", soldOutItems: ["Belvedere Pure 1.75L"] },
  executiveSummary: "Saturday night at \u00c9toile delivered $12,420 in revenue across 143 orders — 6.4% below last Saturday but 8.2% above the four-week average. Latin Night drove a 22% uplift in Main Floor capacity, peaking at 55 guests at 01:00. Sofia Lévesque led the bar with $2,900 served across 34 orders. Two low-severity incidents were recorded and resolved. Belvedere Pure 1.75L sold out at 02:30; restock was confirmed. No high-severity incidents, no evacuation events. Action items: restock Belvedere for Thursday, confirm VIP-02's bottle parade setup for Friday.",
  actionItems: [
    "Restock Belvedere Pure 1.75L before Thursday opening",
    "Confirm VIP-02 bottle parade setup for Friday's DJ Sora event",
    "Follow up with no-show reservation contacts (2 groups)",
    "Review Théo Tremblay's comp rate (4.8% — above 3% threshold)",
  ],
  emailed: false,
};
