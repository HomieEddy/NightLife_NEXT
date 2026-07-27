import type { Venue, Zone, VenueTable } from "@/lib/types";

export const mockVenue: Venue = {
  id: "venue-1",
  name: "Velvet Montréal",
  slug: "velvet-montreal",
  address: "1436 Boulevard Saint-Laurent",
  city: "Montréal",
  timezone: "America/Montreal",
  currency: "CAD",
  openingHours: [
    { day: "Thursday", open: "22:00", close: "04:00" },
    { day: "Friday", open: "22:00", close: "06:00" },
    { day: "Saturday", open: "22:00", close: "06:00" },
  ],
  nightStartHour: 18,
  nightEndHour: 10,
  serviceFees: [
    { id: "fee-service", name: "Service", type: "percentage", value: 5 },
    { id: "fee-tps", name: "TPS", type: "percentage", value: 5 },
    { id: "fee-tvq", name: "TVQ", type: "percentage", value: 9.975 },
  ],
  publicSlug: "velvet-montreal",
  autoApproveGuests: false,
  floorMap: { width: 16, height: 9 },
  logoInitials: "VM",
  slaThresholds: {
    orderWarnMinutes: 6,
    orderCriticalMinutes: 12,
    helpWarnMinutes: 4,
    helpCriticalMinutes: 8,
  },
  lastCallAutoFlagTables: true,
  tipPresets: [15, 20],
  defaultTipPct: 15,
  compThresholdCents: 10000, // comps over $100 escalate to manager approval
  minimumSpendWarningRatio: 0.25,
  legalCapacity: 400,
  occupancyWarnRatio: 0.9,
  coatCheckEnabled: true,
  doorRequiresIdCheck: true,
};

export const mockZones: Zone[] = [
  {
    id: "zone-vip",
    venueId: "venue-1",
    name: "VIP Mezzanine",
    description: "Bottle-service booths overlooking the main floor",
    color: "violet",
    tableCount: 6,
  },
  {
    id: "zone-dance",
    venueId: "venue-1",
    name: "Main Floor",
    description: "High-tops around the dance floor",
    color: "fuchsia",
    tableCount: 8,
  },
  {
    id: "zone-terrace",
    venueId: "venue-1",
    name: "Terrace",
    description: "Open-air lounge seating",
    color: "cyan",
    tableCount: 5,
  },
  {
    id: "zone-bar",
    venueId: "venue-1",
    name: "Back Bar",
    description: "Intimate bar-side seating",
    color: "amber",
    tableCount: 4,
  },
];

export const mockTables: VenueTable[] = [
  { id: "t-vip-1", zoneId: "zone-vip", code: "VIP-01", label: "Booth 1", seats: 8, minimumSpend: 800, status: "occupied", qrSlug: "demo-table" },
  { id: "t-vip-2", zoneId: "zone-vip", code: "VIP-02", label: "Booth 2", seats: 8, minimumSpend: 800, status: "occupied", qrSlug: "vip-02" },
  { id: "t-vip-3", zoneId: "zone-vip", code: "VIP-03", label: "Booth 3", seats: 10, minimumSpend: 1200, status: "reserved", qrSlug: "vip-03" },
  { id: "t-vip-4", zoneId: "zone-vip", code: "VIP-04", label: "Booth 4", seats: 6, minimumSpend: 600, status: "open", qrSlug: "vip-04" },
  { id: "t-vip-5", zoneId: "zone-vip", code: "VIP-05", label: "Booth 5", seats: 6, minimumSpend: 600, status: "open", qrSlug: "vip-05" },
  { id: "t-vip-6", zoneId: "zone-vip", code: "VIP-06", label: "Skyline Booth", seats: 12, minimumSpend: 2000, status: "reserved", qrSlug: "vip-06" },
  { id: "t-mf-1", zoneId: "zone-dance", code: "MF-01", label: "High-top 1", seats: 4, minimumSpend: null, status: "occupied", qrSlug: "mf-01" },
  { id: "t-mf-2", zoneId: "zone-dance", code: "MF-02", label: "High-top 2", seats: 4, minimumSpend: null, status: "occupied", qrSlug: "mf-02" },
  { id: "t-mf-3", zoneId: "zone-dance", code: "MF-03", label: "High-top 3", seats: 4, minimumSpend: null, status: "open", qrSlug: "mf-03" },
  { id: "t-mf-4", zoneId: "zone-dance", code: "MF-04", label: "High-top 4", seats: 4, minimumSpend: null, status: "open", qrSlug: "mf-04" },
  { id: "t-mf-5", zoneId: "zone-dance", code: "MF-05", label: "High-top 5", seats: 6, minimumSpend: null, status: "occupied", qrSlug: "mf-05" },
  { id: "t-mf-6", zoneId: "zone-dance", code: "MF-06", label: "High-top 6", seats: 6, minimumSpend: null, status: "closed", qrSlug: "mf-06" },
  { id: "t-mf-7", zoneId: "zone-dance", code: "MF-07", label: "High-top 7", seats: 4, minimumSpend: null, status: "open", qrSlug: "mf-07" },
  { id: "t-mf-8", zoneId: "zone-dance", code: "MF-08", label: "High-top 8", seats: 4, minimumSpend: null, status: "open", qrSlug: "mf-08" },
  { id: "t-ter-1", zoneId: "zone-terrace", code: "TER-01", label: "Lounge 1", seats: 6, minimumSpend: 300, status: "occupied", qrSlug: "ter-01" },
  { id: "t-ter-2", zoneId: "zone-terrace", code: "TER-02", label: "Lounge 2", seats: 6, minimumSpend: 300, status: "open", qrSlug: "ter-02" },
  { id: "t-ter-3", zoneId: "zone-terrace", code: "TER-03", label: "Lounge 3", seats: 8, minimumSpend: 400, status: "reserved", qrSlug: "ter-03" },
  { id: "t-ter-4", zoneId: "zone-terrace", code: "TER-04", label: "Cabana", seats: 10, minimumSpend: 600, status: "open", qrSlug: "ter-04" },
  { id: "t-ter-5", zoneId: "zone-terrace", code: "TER-05", label: "Fire Pit", seats: 8, minimumSpend: 400, status: "occupied", qrSlug: "ter-05" },
  { id: "t-bar-1", zoneId: "zone-bar", code: "BAR-01", label: "Bar Nook 1", seats: 2, minimumSpend: null, status: "occupied", qrSlug: "bar-01" },
  { id: "t-bar-2", zoneId: "zone-bar", code: "BAR-02", label: "Bar Nook 2", seats: 2, minimumSpend: null, status: "open", qrSlug: "bar-02" },
  { id: "t-bar-3", zoneId: "zone-bar", code: "BAR-03", label: "Bar Nook 3", seats: 4, minimumSpend: null, status: "open", qrSlug: "bar-03" },
  { id: "t-bar-4", zoneId: "zone-bar", code: "BAR-04", label: "Bar Nook 4", seats: 4, minimumSpend: null, status: "closed", qrSlug: "bar-04" },
];

/** The table the /g/demo-table QR flow lands on. */
export const DEMO_TABLE_SLUG = "demo-table";
