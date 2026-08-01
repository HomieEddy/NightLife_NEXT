import type {
  CommissionRule,
  CommissionStatement,
  Shift,
  ShiftTemplate,
  TimeEntry,
  TipPoolRule,
  TipDistribution,
} from "@/lib/types";

export const mockShiftTemplates: ShiftTemplate[] = [
  { id: "sht-am-1", venueId: "venue-1", staffId: "st-amara",  dayOfWeek: 5, startTime: "21:00", endTime: "06:00", zoneId: null, role: "manager",   active: true },
  { id: "sht-am-2", venueId: "venue-1", staffId: "st-amara",  dayOfWeek: 6, startTime: "21:00", endTime: "06:00", zoneId: null, role: "manager",   active: true },
  { id: "sht-lu-1", venueId: "venue-1", staffId: "st-lucas",  dayOfWeek: 4, startTime: "21:30", endTime: "04:00", zoneId: "zone-vip", role: "host", active: true },
  { id: "sht-lu-2", venueId: "venue-1", staffId: "st-lucas",  dayOfWeek: 5, startTime: "21:30", endTime: "06:00", zoneId: "zone-vip", role: "host", active: true },
  { id: "sht-so-1", venueId: "venue-1", staffId: "st-sofia",  dayOfWeek: 5, startTime: "22:00", endTime: "06:00", zoneId: "zone-bar", role: "bartender", active: true },
  { id: "sht-so-2", venueId: "venue-1", staffId: "st-sofia",  dayOfWeek: 6, startTime: "22:00", endTime: "06:00", zoneId: "zone-bar", role: "bartender", active: true },
  { id: "sht-th-1", venueId: "venue-1", staffId: "st-theo",   dayOfWeek: 6, startTime: "22:00", endTime: "06:00", zoneId: "zone-dance", role: "bartender", active: true },
  { id: "sht-ni-1", venueId: "venue-1", staffId: "st-nina",   dayOfWeek: 5, startTime: "22:30", endTime: "05:00", zoneId: "zone-vip", role: "runner", active: true },
  { id: "sht-ni-2", venueId: "venue-1", staffId: "st-nina",   dayOfWeek: 6, startTime: "22:30", endTime: "05:00", zoneId: "zone-vip", role: "runner", active: true },
  { id: "sht-vi-1", venueId: "venue-1", staffId: "st-viktor", dayOfWeek: 5, startTime: "22:00", endTime: "06:00", zoneId: null, role: "security", active: true },
  { id: "sht-vi-2", venueId: "venue-1", staffId: "st-viktor", dayOfWeek: 6, startTime: "22:00", endTime: "06:00", zoneId: null, role: "security", active: true },
  { id: "sht-ma-1", venueId: "venue-1", staffId: "st-marcus", dayOfWeek: 5, startTime: "21:00", endTime: "05:00", zoneId: null, role: "security", active: true },
  { id: "sht-ju-1", venueId: "venue-1", staffId: "st-julien", dayOfWeek: 5, startTime: "21:00", endTime: "03:00", zoneId: "zone-vip", role: "promoter", active: true },
  { id: "sht-ch-1", venueId: "venue-1", staffId: "st-chloe",  dayOfWeek: 5, startTime: "21:00", endTime: "03:00", zoneId: "zone-vip", role: "promoter", active: true },
];

// Last week (Jul 20-26): completed shifts with realistic variance
export const mockShifts: Shift[] = [
  { id: "shift-fri-amara",  venueId: "venue-1", staffId: "st-amara",  businessDate: "2026-07-24", scheduledStart: "21:00", scheduledEnd: "06:00", zoneId: null, role: "manager",    status: "completed", templateId: "sht-am-1" },
  { id: "shift-fri-lucas",  venueId: "venue-1", staffId: "st-lucas",  businessDate: "2026-07-24", scheduledStart: "21:30", scheduledEnd: "04:00", zoneId: "zone-vip", role: "host", status: "completed", templateId: "sht-lu-2" },
  { id: "shift-fri-sofia",  venueId: "venue-1", staffId: "st-sofia",  businessDate: "2026-07-24", scheduledStart: "22:00", scheduledEnd: "06:00", zoneId: "zone-bar", role: "bartender",  status: "completed", templateId: "sht-so-1" },
  { id: "shift-fri-nina",   venueId: "venue-1", staffId: "st-nina",   businessDate: "2026-07-24", scheduledStart: "22:30", scheduledEnd: "05:00", zoneId: "zone-vip", role: "runner",     status: "completed", templateId: "sht-ni-1" },
  { id: "shift-fri-viktor", venueId: "venue-1", staffId: "st-viktor", businessDate: "2026-07-24", scheduledStart: "22:00", scheduledEnd: "06:00", zoneId: null, role: "security",   status: "completed", templateId: "sht-vi-1" },
  { id: "shift-fri-marcus", venueId: "venue-1", staffId: "st-marcus", businessDate: "2026-07-24", scheduledStart: "21:00", scheduledEnd: "05:00", zoneId: null, role: "security",   status: "completed", templateId: "sht-ma-1" },
  { id: "shift-fri-julien", venueId: "venue-1", staffId: "st-julien", businessDate: "2026-07-24", scheduledStart: "21:00", scheduledEnd: "03:00", zoneId: "zone-vip", role: "promoter",  status: "completed", templateId: "sht-ju-1" },
  { id: "shift-fri-chloe",  venueId: "venue-1", staffId: "st-chloe",  businessDate: "2026-07-24", scheduledStart: "21:00", scheduledEnd: "03:00", zoneId: "zone-vip", role: "promoter",  status: "no-show", templateId: "sht-ch-1" },
  { id: "shift-sat-amara",  venueId: "venue-1", staffId: "st-amara",  businessDate: "2026-07-25", scheduledStart: "21:00", scheduledEnd: "06:00", zoneId: null, role: "manager",    status: "completed", templateId: "sht-am-2" },
  { id: "shift-sat-sofia",  venueId: "venue-1", staffId: "st-sofia",  businessDate: "2026-07-25", scheduledStart: "22:00", scheduledEnd: "06:00", zoneId: "zone-bar", role: "bartender",  status: "completed", templateId: "sht-so-2" },
  { id: "shift-sat-theo",   venueId: "venue-1", staffId: "st-theo",   businessDate: "2026-07-25", scheduledStart: "22:00", scheduledEnd: "06:00", zoneId: "zone-dance", role: "bartender", status: "completed", templateId: "sht-th-1" },
  { id: "shift-sat-nina",   venueId: "venue-1", staffId: "st-nina",   businessDate: "2026-07-25", scheduledStart: "22:30", scheduledEnd: "05:00", zoneId: "zone-vip", role: "runner",     status: "completed", templateId: "sht-ni-2" },
  { id: "shift-sat-viktor", venueId: "venue-1", staffId: "st-viktor", businessDate: "2026-07-25", scheduledStart: "22:00", scheduledEnd: "06:00", zoneId: null, role: "security",   status: "completed", templateId: "sht-vi-2" },
];

// Last Friday's time entries with realistic variance
export const mockTimeEntries: TimeEntry[] = [
  // Viktor — on time
  { id: "te-vik-fri", venueId: "venue-1", shiftId: "shift-fri-viktor", staffId: "st-viktor", clockInAt: "2026-07-24T21:55:00-04:00", clockOutAt: "2026-07-25T06:10:00-04:00", breaks: [], source: "self", minutesWorked: 495 },
  // Marcus — late
  { id: "te-mar-fri", venueId: "venue-1", shiftId: "shift-fri-marcus", staffId: "st-marcus", clockInAt: "2026-07-24T21:23:00-04:00", clockOutAt: "2026-07-25T05:05:00-04:00", breaks: [{ startedAt: "2026-07-25T00:00:00-04:00", endedAt: "2026-07-25T00:30:00-04:00", paid: false }], source: "self", minutesWorked: 432 },
  // Sofia — took a paid break
  { id: "te-sof-fri", venueId: "venue-1", shiftId: "shift-fri-sofia", staffId: "st-sofia", clockInAt: "2026-07-24T21:58:00-04:00", clockOutAt: "2026-07-25T06:05:00-04:00", breaks: [{ startedAt: "2026-07-25T01:00:00-04:00", endedAt: "2026-07-25T01:15:00-04:00", paid: true }], source: "self", minutesWorked: 487 },
  // Nina — exact start
  { id: "te-nina-fri", venueId: "venue-1", shiftId: "shift-fri-nina", staffId: "st-nina", clockInAt: "2026-07-24T22:30:00-04:00", clockOutAt: "2026-07-25T05:02:00-04:00", breaks: [], source: "self", minutesWorked: 392 },
  // Amara — early
  { id: "te-am-fri", venueId: "venue-1", shiftId: "shift-fri-amara", staffId: "st-amara", clockInAt: "2026-07-24T20:45:00-04:00", clockOutAt: "2026-07-25T06:10:00-04:00", breaks: [], source: "self", minutesWorked: 565 },
  // Lucas — clocked in late (variance)
  { id: "te-lu-fri", venueId: "venue-1", shiftId: "shift-fri-lucas", staffId: "st-lucas", clockInAt: "2026-07-24T21:52:00-04:00", clockOutAt: "2026-07-25T04:05:00-04:00", breaks: [], source: "self", minutesWorked: 373 },
  // Julien — clocked in
  { id: "te-ju-fri", venueId: "venue-1", shiftId: "shift-fri-julien", staffId: "st-julien", clockInAt: "2026-07-24T21:05:00-04:00", clockOutAt: "2026-07-25T03:02:00-04:00", breaks: [], source: "self", minutesWorked: 357 },
];

export const mockTimeOffRequests = [
  { id: "to-1", venueId: "venue-1", staffId: "st-theo", startDate: "2026-07-25", endDate: "2026-07-25", reason: "Personal day", status: "approved" as const, decidedByStaffId: "st-amara", decidedAt: "2026-07-22T10:00:00-04:00" },
];

export const mockShiftSwapRequests = [
  { id: "swap-1", venueId: "venue-1", shiftId: "shift-sat-nina", requestedByStaffId: "st-nina", status: "open" as const },
];

// Staff extensions for plan 18
export const mockStaffHourlyRates: Record<string, number> = {
  "st-amara":  2500, // $25/h
  "st-lucas":  2000,
  "st-sofia":  2200,
  "st-theo":   2200,
  "st-nina":   1800,
  "st-karim":  1800,
  "st-viktor": 2000,
  "st-marcus": 2000,
  "st-emma":   2000,
  "st-julien": 0, // commission only
  "st-chloe":  0, // commission only
};

export const mockStaffEmploymentTypes: Record<string, "hourly" | "salaried" | "contractor" | "commission"> = {
  "st-amara":  "salaried",
  "st-lucas":  "hourly",
  "st-sofia":  "hourly",
  "st-theo":   "hourly",
  "st-nina":   "hourly",
  "st-karim":  "hourly",
  "st-viktor": "hourly",
  "st-marcus": "hourly",
  "st-emma":   "hourly",
  "st-julien": "commission",
  "st-chloe":  "commission",
};

export const mockTipPoolRules: TipPoolRule[] = [
  {
    id: "tip-rule-1", venueId: "venue-1", name: "Hours-weighted",
    basis: "hours-weighted", includeRoles: ["bartender", "runner", "host", "security"],
    houseRetentionPct: 0, active: true,
  },
];

export const mockTipDistributions: TipDistribution[] = [
  {
    id: "td-fri", venueId: "venue-1", businessDate: "2026-07-24", ruleId: "tip-rule-1",
    poolCents: 185000, // $1,850
    lines: [
      { staffId: "st-viktor", basisValue: 495, shareCents: 37000 },
      { staffId: "st-marcus", basisValue: 432, shareCents: 32360 },
      { staffId: "st-sofia",  basisValue: 487, shareCents: 36420 },
      { staffId: "st-nina",   basisValue: 392, shareCents: 29280 },
      { staffId: "st-lucas",  basisValue: 373, shareCents: 27880 },
      { staffId: "st-julien", basisValue: 357, shareCents: 22060 }, // promoter also gets tips
    ],
    computedAt: "2026-07-25T06:30:00-04:00",
    closedByStaffId: "st-amara",
  },
];

export const mockCommissionRules: CommissionRule[] = [
  {
    id: "cr-julien", venueId: "venue-1", staffId: "st-julien", basis: "net-revenue", ratePct: 10,
    qualifier: { minPartySize: 4 },
  },
  {
    id: "cr-chloe", venueId: "venue-1", staffId: "st-chloe", basis: "per-reservation", flatCents: 2500, // $25
  },
];

export const mockCommissionStatements: CommissionStatement[] = [
  {
    id: "cs-julien-0724", venueId: "venue-1", staffId: "st-julien",
    periodStart: "2026-07-20T00:00:00-04:00", periodEnd: "2026-07-26T23:59:59-04:00",
    lines: [
      { sourceType: "session", sourceId: "s-julien-1", basisCents: 420000, earnedCents: 42000 },
      { sourceType: "session", sourceId: "s-julien-2", basisCents: 310000, earnedCents: 31000 },
    ],
    totalCents: 73000, status: "draft",
  },
  {
    id: "cs-chloe-0724", venueId: "venue-1", staffId: "st-chloe",
    periodStart: "2026-07-20T00:00:00-04:00", periodEnd: "2026-07-26T23:59:59-04:00",
    lines: [
      { sourceType: "reservation", sourceId: "r-chloe-1", basisCents: 0, earnedCents: 2500 },
      { sourceType: "reservation", sourceId: "r-chloe-2", basisCents: 0, earnedCents: 2500 },
      { sourceType: "reservation", sourceId: "r-chloe-3", basisCents: 0, earnedCents: 2500 },
    ],
    totalCents: 7500, status: "draft",
  },
];
