/**
 * Canonical seed corpus — single narrative source for both demo mock-data and
 * live seed scripts (§9.4). Every constant, generator, and model lives here.
 *
 * Demo track: mock-data.ts files import and clone the generated arrays.
 * Live track: prisma/seed*.ts import and write through Prisma.
 *
 * All data tells one story: Velvet Montréal, a 400-capacity nightclub on
 * Boulevard Saint-Laurent, open Thu/Fri/Sat, with a 10-person roster, VIP
 * bottle service, and a visible 90-day business arc.
 *
 * Deterministic: seeded PRNG, all dates relative to runtime. Idempotent re-runs
 * produce identical output for the same seed.
 *
 * Fee math routes through src/features/ordering/fees.ts so seeded orders
 * match what the live app computes — no drift between seed data and runtime.
 */

import { computeFeeLines, computeServiceFee } from "@/features/ordering/fees";
import type { Venue } from "@/lib/types";

// ── Seeded PRNG (same LCG as seed-staging.ts) ──────────────────────────

let _seed = 42;

/** Reset the PRNG to a known seed. Call before generating a batch. */
export function reseedRng(seed = 42): void {
  _seed = seed;
}

/** Returns a float in [0, 1). */
export function rand(): number {
  _seed = (_seed * 1103515245 + 12345) & 0x7fffffff;
  return _seed / 0x7fffffff;
}

/** Integer in [min, max] inclusive. */
export function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

/** Pick a random element from an array. */
export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

/** Pick N distinct elements (no repeats). */
export function pickDistinct<T>(arr: readonly T[], n: number): T[] {
  const pool = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && pool.length > 0; i++) {
    out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  }
  return out;
}

/** Deterministic hash of a string, used for stable IDs across re-runs. */
export function stableHash(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

/** Deterministic 6-digit PIN from a string. */
export function seededPin(id: string): string {
  return String(stableHash(id) % 1000000).padStart(6, "0");
}

// ── Time helpers (all relative to runtime) ─────────────────────────────

export function today(): Date {
  return new Date();
}

export function yesterday(): Date {
  const d = today();
  d.setDate(d.getDate() - 1);
  return d;
}

export function daysAgo(n: number): Date {
  const d = today();
  d.setDate(d.getDate() - n);
  return d;
}

/** Local calendar date string — UTC slicing drifted a day for four hours
 *  every evening (the generator checks local weekdays; the UTC date of a
 *  20:00+ local instant is the NEXT day, breaking open-night determinism). */
export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function minsAgo(m: number): string {
  return new Date(Date.now() - m * 60_000).toISOString();
}

/** Business date string for a timestamp, respecting the venue's night-end rollover. */
export function businessDateFor(iso: string, nightEndHour: number): string {
  const d = new Date(iso);
  if (d.getUTCHours() < nightEndHour) {
    d.setDate(d.getDate() - 1);
  }
  return d.toISOString().slice(0, 10);
}

/** Day-of-week names indexed by Date.getDay(). */
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

// ── Narrative: the venue ───────────────────────────────────────────────

export const CORPUS_VENUE = {
  id: "venue-1",
  name: "Velvet Montréal",
  slug: "velvet-montreal",
  orgSlug: "velvet-mtl",
  address: "1436 Boulevard Saint-Laurent",
  city: "Montréal",
  timezone: "America/Montreal",
  currency: "CAD" as const,
  logoInitials: "VM",
  nightStartHour: 18,
  nightEndHour: 10,
  legalCapacity: 400,
  legalDrinkingAge: 18,
  occupancyWarnRatio: 0.9,
  compThresholdCents: 10_000,
  minimumSpendWarningRatio: 0.25,
  coatCheckEnabled: true,
  doorRequiresIdCheck: true,
  lastCallAutoFlagTables: true,
  defaultTipPct: 15,
  tipPresets: [15, 20] as number[],
  autoApproveGuests: false,
  openingHours: [
    { day: "Thursday", open: "22:00", close: "04:00" },
    { day: "Friday", open: "22:00", close: "06:00" },
    { day: "Saturday", open: "22:00", close: "06:00" },
  ] as { day: string; open: string; close: string }[],
  serviceFees: [
    { id: "fee-service", name: "Service", type: "percentage" as const, value: 5 },
    { id: "fee-tps", name: "TPS", type: "percentage" as const, value: 5 },
    { id: "fee-tvq", name: "TVQ", type: "percentage" as const, value: 9.975 },
  ],
  slaThresholds: {
    orderWarnMinutes: 6,
    orderCriticalMinutes: 12,
    helpWarnMinutes: 4,
    helpCriticalMinutes: 8,
  },
  floorMap: { width: 16, height: 9 },
  publicSlug: "velvet",
  autoGratuityRules: [] as { minPartySize: number; ratePct: number }[],
} as const;

/** Open day names for quick lookup. */
export const OPEN_DAY_NAMES = new Set(CORPUS_VENUE.openingHours.map((h) => h.day));

export function isOpenNight(d: Date): boolean {
  return OPEN_DAY_NAMES.has(DAY_NAMES[d.getDay()]);
}

// ── Narrative: zones ────────────────────────────────────────────────────

export const CORPUS_ZONES = [
  {
    id: "zone-vip",
    name: "VIP Mezzanine",
    description: "Bottle-service booths overlooking the main floor",
    color: "violet",
    capacity: 60,
    tableCount: 6,
  },
  {
    id: "zone-dance",
    name: "Main Floor",
    description: "High-tops around the dance floor",
    color: "fuchsia",
    capacity: 200,
    tableCount: 8,
  },
  {
    id: "zone-terrace",
    name: "Terrace",
    description: "Open-air lounge seating",
    color: "cyan",
    capacity: 80,
    tableCount: 5,
  },
  {
    id: "zone-bar",
    name: "Back Bar",
    description: "Intimate bar-side seating",
    color: "amber",
    capacity: null,
    tableCount: 4,
  },
] as const;

// ── Narrative: tables ───────────────────────────────────────────────────

export interface CorpusTable {
  id: string;
  zoneId: string;
  code: string;
  label: string;
  seats: number;
  minimumSpend: number | null;
  qrSlug: string;
}

export const CORPUS_TABLES: CorpusTable[] = [
  { id: "t-vip-1", zoneId: "zone-vip", code: "VIP-01", label: "Booth 1", seats: 8, minimumSpend: 800, qrSlug: "demo-table" },
  { id: "t-vip-2", zoneId: "zone-vip", code: "VIP-02", label: "Booth 2", seats: 8, minimumSpend: 800, qrSlug: "vip-02" },
  { id: "t-vip-3", zoneId: "zone-vip", code: "VIP-03", label: "Booth 3", seats: 10, minimumSpend: 1200, qrSlug: "vip-03" },
  { id: "t-vip-4", zoneId: "zone-vip", code: "VIP-04", label: "Booth 4", seats: 6, minimumSpend: 600, qrSlug: "vip-04" },
  { id: "t-vip-5", zoneId: "zone-vip", code: "VIP-05", label: "Booth 5", seats: 6, minimumSpend: 600, qrSlug: "vip-05" },
  { id: "t-vip-6", zoneId: "zone-vip", code: "VIP-06", label: "Skyline Booth", seats: 12, minimumSpend: 2000, qrSlug: "vip-06" },
  { id: "t-mf-1", zoneId: "zone-dance", code: "MF-01", label: "High-top 1", seats: 4, minimumSpend: null, qrSlug: "mf-01" },
  { id: "t-mf-2", zoneId: "zone-dance", code: "MF-02", label: "High-top 2", seats: 4, minimumSpend: null, qrSlug: "mf-02" },
  { id: "t-mf-3", zoneId: "zone-dance", code: "MF-03", label: "High-top 3", seats: 4, minimumSpend: null, qrSlug: "mf-03" },
  { id: "t-mf-4", zoneId: "zone-dance", code: "MF-04", label: "High-top 4", seats: 4, minimumSpend: null, qrSlug: "mf-04" },
  { id: "t-mf-5", zoneId: "zone-dance", code: "MF-05", label: "High-top 5", seats: 6, minimumSpend: null, qrSlug: "mf-05" },
  { id: "t-mf-6", zoneId: "zone-dance", code: "MF-06", label: "High-top 6", seats: 6, minimumSpend: null, qrSlug: "mf-06" },
  { id: "t-mf-7", zoneId: "zone-dance", code: "MF-07", label: "High-top 7", seats: 4, minimumSpend: null, qrSlug: "mf-07" },
  { id: "t-mf-8", zoneId: "zone-dance", code: "MF-08", label: "High-top 8", seats: 4, minimumSpend: null, qrSlug: "mf-08" },
  { id: "t-ter-1", zoneId: "zone-terrace", code: "TER-01", label: "Lounge 1", seats: 6, minimumSpend: 300, qrSlug: "ter-01" },
  { id: "t-ter-2", zoneId: "zone-terrace", code: "TER-02", label: "Lounge 2", seats: 6, minimumSpend: 300, qrSlug: "ter-02" },
  { id: "t-ter-3", zoneId: "zone-terrace", code: "TER-03", label: "Lounge 3", seats: 8, minimumSpend: 400, qrSlug: "ter-03" },
  { id: "t-ter-4", zoneId: "zone-terrace", code: "TER-04", label: "Cabana", seats: 10, minimumSpend: 600, qrSlug: "ter-04" },
  { id: "t-ter-5", zoneId: "zone-terrace", code: "TER-05", label: "Fire Pit", seats: 8, minimumSpend: 400, qrSlug: "ter-05" },
  { id: "t-bar-1", zoneId: "zone-bar", code: "BAR-01", label: "Bar Nook 1", seats: 2, minimumSpend: null, qrSlug: "bar-01" },
  { id: "t-bar-2", zoneId: "zone-bar", code: "BAR-02", label: "Bar Nook 2", seats: 2, minimumSpend: null, qrSlug: "bar-02" },
  { id: "t-bar-3", zoneId: "zone-bar", code: "BAR-03", label: "Bar Nook 3", seats: 4, minimumSpend: null, qrSlug: "bar-03" },
  { id: "t-bar-4", zoneId: "zone-bar", code: "BAR-04", label: "Bar Nook 4", seats: 4, minimumSpend: null, qrSlug: "bar-04" },
];

export const DEMO_TABLE_SLUG = "demo-table";

// ── Narrative: roster ───────────────────────────────────────────────────

export type CorpusRole = "manager" | "host" | "bartender" | "runner" | "security" | "promoter";

export interface CorpusStaffMember {
  id: string;
  name: string;
  email: string;
  role: CorpusRole;
  initials: string;
  phone: string;
  hourlyRateCents: number;
  employmentType: "salaried" | "hourly" | "commission";
  tipPoolWeight: number;
  nights: number[]; // 0=Sun..6=Sat
  assignedZoneIds: string[];
}

export const CORPUS_ROSTER: CorpusStaffMember[] = [
  {
    id: "st-amara", name: "Amara Diallo", email: "amara@velvetmtl.club",
    role: "manager", initials: "AD", phone: "+1 514 555 0101",
    hourlyRateCents: 2500, employmentType: "salaried", tipPoolWeight: 1.0,
    nights: [4, 5, 6], assignedZoneIds: [],
  },
  {
    id: "st-nina", name: "Nina Kovač", email: "nina@velvetmtl.club",
    role: "runner", initials: "NK", phone: "+1 514 555 0102",
    hourlyRateCents: 1800, employmentType: "hourly", tipPoolWeight: 1.0,
    nights: [4, 5, 6], assignedZoneIds: [],
  },
  {
    id: "st-sofia", name: "Sofia Moreau", email: "sofia@velvetmtl.club",
    role: "bartender", initials: "SM", phone: "+1 514 555 0103",
    hourlyRateCents: 2200, employmentType: "hourly", tipPoolWeight: 1.0,
    nights: [4, 5, 6], assignedZoneIds: ["zone-bar"],
  },
  {
    id: "st-theo", name: "Theo Andersson", email: "theo@velvetmtl.club",
    role: "bartender", initials: "TA", phone: "+1 514 555 0104",
    hourlyRateCents: 2200, employmentType: "hourly", tipPoolWeight: 1.0,
    nights: [5, 6], assignedZoneIds: ["zone-bar"],
  },
  {
    id: "st-karim", name: "Karim Haddad", email: "karim@velvetmtl.club",
    role: "runner", initials: "KH", phone: "+1 514 555 0105",
    hourlyRateCents: 1800, employmentType: "hourly", tipPoolWeight: 1.0,
    nights: [5, 6], assignedZoneIds: [],
  },
  {
    id: "st-maya", name: "Maya Petrov", email: "maya@velvetmtl.club",
    role: "runner", initials: "MP", phone: "+1 514 555 0106",
    hourlyRateCents: 1800, employmentType: "hourly", tipPoolWeight: 1.0,
    nights: [4, 5], assignedZoneIds: [],
  },
  {
    id: "st-lucas", name: "Lucas Bergeron", email: "lucas@velvetmtl.club",
    role: "host", initials: "LB", phone: "+1 514 555 0107",
    hourlyRateCents: 2000, employmentType: "hourly", tipPoolWeight: 1.0,
    nights: [4, 5], assignedZoneIds: ["zone-vip"],
  },
  {
    id: "st-emma", name: "Emma Wallace", email: "emma@velvetmtl.club",
    role: "host", initials: "EW", phone: "+1 514 555 0108",
    hourlyRateCents: 2000, employmentType: "hourly", tipPoolWeight: 1.0,
    nights: [5, 6], assignedZoneIds: ["zone-vip"],
  },
  {
    id: "st-chloe", name: "Chloé Fontaine", email: "chloe@velvetmtl.club",
    role: "host", initials: "CF", phone: "+1 514 555 0109",
    hourlyRateCents: 2000, employmentType: "hourly", tipPoolWeight: 1.0,
    nights: [4, 6], assignedZoneIds: ["zone-vip"],
  },
  {
    id: "st-viktor", name: "Viktor Michaud", email: "viktor@velvetmtl.club",
    role: "security", initials: "VM", phone: "+1 514 555 0110",
    hourlyRateCents: 2200, employmentType: "hourly", tipPoolWeight: 1.0,
    nights: [4, 5, 6], assignedZoneIds: [],
  },
];

export const PLATFORM_ADMIN = {
  name: "Platform Admin",
  email: "admin@nightlifext.com",
  isPlatformAdmin: true,
  role: "admin" as const,
};

export const DEMO_PASSWORD = "demo1234";

// ── Narrative: menu catalog ─────────────────────────────────────────────

export const CORPUS_MENU_CATEGORIES = [
  { id: "cat-champagne", name: "Champagne", description: "Cuvées prestige servies dans un seau scintillant", sortOrder: 1 },
  { id: "cat-tequila", name: "Tequila", description: "Blanco, reposado et añejo — citrons et sel inclus", sortOrder: 2 },
  { id: "cat-vodka", name: "Vodka", description: "Servie glacée à votre table avec vos washers préférés", sortOrder: 3 },
  { id: "cat-cognac", name: "Cognac", description: "V.S.O.P et X.O pour la banquette du fond", sortOrder: 4 },
  { id: "cat-rhum", name: "Rhum", description: "Rhums caribéens vieillis, sec ou long drink", sortOrder: 5 },
  { id: "cat-whisky", name: "Whisky", description: "Single malts et assemblages rares", sortOrder: 6 },
  { id: "cat-gin", name: "Gin", description: "Bouteilles botaniques avec toniques premium", sortOrder: 7 },
  { id: "cat-washers", name: "Washers", description: "Jus, sodas, boissons énergisantes et eau pour votre set-up", sortOrder: 8 },
] as const;

export interface CorpusMenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  icon: string;
  tags: string[];
  isAvailable: boolean;
  inventory: number;
  isAlcoholic: boolean;
  abv: number | null;
}

export const CORPUS_MENU_ITEMS: CorpusMenuItem[] = [
  // Champagne
  { id: "mi-moet", categoryId: "cat-champagne", name: "Moët & Chandon Impérial", description: "Le champagne classique de la maison, bien frais.", price: 160, icon: "champagne", tags: [], isAvailable: true, inventory: 24, isAlcoholic: true, abv: 12 },
  { id: "mi-dom", categoryId: "cat-champagne", name: "Dom Pérignon Vintage", description: "Cuvée de prestige iconique.", price: 320, icon: "champagne", tags: ["popular"], isAvailable: true, inventory: 12, isAlcoholic: true, abv: 12.5 },
  { id: "mi-ace", categoryId: "cat-champagne", name: "Ace of Spades Brut Gold", description: "Armand de Brignac — la pièce maîtresse.", price: 500, icon: "champagne", tags: ["premium", "popular"], isAvailable: true, inventory: 8, isAlcoholic: true, abv: 12.5 },
  { id: "mi-cristal", categoryId: "cat-champagne", name: "Louis Roederer Cristal", description: "Allocation rare — tant qu'il en reste.", price: 650, icon: "champagne", tags: ["limited"], isAvailable: true, inventory: 4, isAlcoholic: true, abv: 12 },
  // Tequila
  { id: "mi-patron", categoryId: "cat-tequila", name: "Patrón Silver", description: "Blanco smooth, citrons et sal de gusano inclus.", price: 220, icon: "tequila", tags: [], isAvailable: true, inventory: 15, isAlcoholic: true, abv: 40 },
  { id: "mi-don-julio", categoryId: "cat-tequila", name: "Don Julio 1942", description: "L'añejo qui n'a plus besoin de présentation.", price: 340, icon: "tequila", tags: ["popular"], isAvailable: true, inventory: 10, isAlcoholic: true, abv: 40 },
  { id: "mi-clase-azul", categoryId: "cat-tequila", name: "Clase Azul Reposado", description: "Bouteille en céramique peinte à la main.", price: 400, icon: "tequila", tags: ["premium"], isAvailable: true, inventory: 6, isAlcoholic: true, abv: 40 },
  // Vodka
  { id: "mi-titos", categoryId: "cat-vodka", name: "Tito's Handmade 1L", description: "Vodka craft qui plaît à tout le monde.", price: 180, icon: "vodka", tags: [], isAvailable: true, inventory: 18, isAlcoholic: true, abv: 40 },
  { id: "mi-greygoose", categoryId: "cat-vodka", name: "Grey Goose 1L", description: "Vodka française classique, servie glacée.", price: 220, icon: "vodka", tags: [], isAvailable: true, inventory: 14, isAlcoholic: true, abv: 40 },
  { id: "mi-belvedere", categoryId: "cat-vodka", name: "Belvedere Pure 1.75L", description: "Format magnum pour tout le booth.", price: 300, icon: "vodka", tags: ["popular"], isAvailable: true, inventory: 9, isAlcoholic: true, abv: 40 },
  // Cognac
  { id: "mi-hennessy", categoryId: "cat-cognac", name: "Hennessy V.S.O.P 1L", description: "Cognac smooth avec washers premium.", price: 260, icon: "cognac", tags: ["popular"], isAvailable: true, inventory: 11, isAlcoholic: true, abv: 40 },
  { id: "mi-dusse", categoryId: "cat-cognac", name: "D'Ussé V.S.O.P", description: "Cognac audacieux et moderne.", price: 280, icon: "cognac", tags: ["new"], isAvailable: true, inventory: 8, isAlcoholic: true, abv: 40 },
  { id: "mi-remy", categoryId: "cat-cognac", name: "Rémy Martin X.O", description: "X.O aux notes célébratoires.", price: 440, icon: "cognac", tags: ["premium"], isAvailable: true, inventory: 5, isAlcoholic: true, abv: 40 },
  // Rhum
  { id: "mi-diplomatico", categoryId: "cat-rhum", name: "Diplomático Reserva Exclusiva", description: "Rhum vénézuélien velouté.", price: 240, icon: "rum", tags: [], isAvailable: true, inventory: 7, isAlcoholic: true, abv: 40 },
  { id: "mi-zacapa", categoryId: "cat-rhum", name: "Ron Zacapa 23", description: "Rhum guatémaltèque vieilli en solera.", price: 270, icon: "rum", tags: ["new"], isAvailable: true, inventory: 6, isAlcoholic: true, abv: 40 },
  // Whisky
  { id: "mi-macallan", categoryId: "cat-whisky", name: "The Macallan 12", description: "Single malt vieilli en fût de sherry.", price: 320, icon: "whisky", tags: ["premium"], isAvailable: true, inventory: 6, isAlcoholic: true, abv: 43 },
  { id: "mi-jw-blue", categoryId: "cat-whisky", name: "Johnnie Walker Blue", description: "Le blend phare, réserve rare.", price: 430, icon: "whisky", tags: ["limited"], isAvailable: true, inventory: 4, isAlcoholic: true, abv: 40 },
  // Gin
  { id: "mi-hendricks", categoryId: "cat-gin", name: "Hendrick's 1L", description: "Frais au concombre, servi avec toniques premium.", price: 210, icon: "gin", tags: [], isAvailable: true, inventory: 10, isAlcoholic: true, abv: 41.4 },
  { id: "mi-monkey", categoryId: "cat-gin", name: "Monkey 47", description: "47 botaniques de la Forêt-Noire.", price: 250, icon: "gin", tags: ["new"], isAvailable: true, inventory: 5, isAlcoholic: true, abv: 47 },
  // Washers
  { id: "mi-coke", categoryId: "cat-washers", name: "Coca-Cola", description: "Canette 355ml.", price: 4, icon: "washer", tags: [], isAvailable: true, inventory: 80, isAlcoholic: false, abv: null },
  { id: "mi-sprite", categoryId: "cat-washers", name: "Sprite", description: "Canette 355ml.", price: 4, icon: "washer", tags: [], isAvailable: true, inventory: 80, isAlcoholic: false, abv: null },
  { id: "mi-cranberry-juice", categoryId: "cat-washers", name: "Cranberry Juice", description: "Jus de canneberge.", price: 5, icon: "washer", tags: [], isAvailable: true, inventory: 40, isAlcoholic: false, abv: null },
  { id: "mi-apple-juice", categoryId: "cat-washers", name: "Apple Juice", description: "Jus de pomme.", price: 5, icon: "washer", tags: [], isAvailable: true, inventory: 40, isAlcoholic: false, abv: null },
  { id: "mi-pineapple-juice", categoryId: "cat-washers", name: "Pineapple Juice", description: "Jus d'ananas.", price: 5, icon: "washer", tags: [], isAvailable: true, inventory: 40, isAlcoholic: false, abv: null },
  { id: "mi-orange-juice", categoryId: "cat-washers", name: "Orange Juice", description: "Jus d'orange.", price: 5, icon: "washer", tags: [], isAvailable: true, inventory: 40, isAlcoholic: false, abv: null },
  { id: "mi-tonic-water", categoryId: "cat-washers", name: "Tonic Water", description: "Fever-Tree 200ml.", price: 4, icon: "washer", tags: [], isAvailable: true, inventory: 60, isAlcoholic: false, abv: null },
  { id: "mi-gingerale", categoryId: "cat-washers", name: "Ginger Ale", description: "Canada Dry 355ml.", price: 4, icon: "washer", tags: [], isAvailable: true, inventory: 60, isAlcoholic: false, abv: null },
  { id: "mi-spring-water-12", categoryId: "cat-washers", name: "Spring Water 12-pack", description: "Pack de 12 bouteilles.", price: 20, icon: "washer", tags: [], isAvailable: true, inventory: 30, isAlcoholic: false, abv: null },
  { id: "mi-redbull", categoryId: "cat-washers", name: "Red Bull", description: "Canette 250ml.", price: 5, icon: "washer", tags: ["popular"], isAvailable: true, inventory: 120, isAlcoholic: false, abv: null },
  { id: "mi-redbull-6pack", categoryId: "cat-washers", name: "Red Bull 6-pack", description: "Pack de 6 canettes.", price: 30, icon: "washer", tags: [], isAvailable: true, inventory: 40, isAlcoholic: false, abv: null },
];

// ── Narrative: guest names ──────────────────────────────────────────────

export const CORPUS_GUEST_FIRST_NAMES = [
  "Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Quinn",
  "Avery", "Blake", "Charlie", "Dana", "Emery", "Finley", "Harper",
  "Jamie", "Kai", "Logan", "Noel", "Reese", "Sage",
] as const;

export const CORPUS_GUEST_LAST_NAMES = [
  "Tremblay", "Côté", "Dubois", "Moreau", "Bergeron", "Nguyen",
  "Patel", "Okafor", "Santos", "Yamamoto", "Lavoie", "Gagnon",
  "Bouchard", "Fortin", "Roy", "Gauthier",
] as const;

export const CORPUS_HELP_TYPES = ["call-waiter", "refill-ice", "clean-table", "security", "bill"] as const;
export const CORPUS_SETTLEMENT_METHODS = ["terminal", "cash", "house"] as const;

// ── Calendar model ──────────────────────────────────────────────────────

/** Volume multiplier for a given night. Fri=1.0, Sat=1.2, Thu=0.6. */
export function nightVolumeMultiplier(d: Date): number {
  const dow = d.getDay();
  if (dow === 5) return 1.0;  // Friday
  if (dow === 6) return 1.2;  // Saturday
  return 0.6;                  // Thursday
}

/** Sessions on a given night, before any outlier modifier. */
export function baseSessionsForNight(d: Date): number {
  const dow = d.getDay();
  if (dow === 5) return randInt(10, 18);   // Fri
  if (dow === 6) return randInt(12, 22);   // Sat
  return randInt(5, 12);                    // Thu
}

export function isWeekend(d: Date): boolean {
  const dow = d.getDay();
  return dow === 5 || dow === 6;
}

// ── Outlier nights (offsets from yesterday, indexed 0 = yesterday) ──────

export interface OutlierNight {
  daysAgo: number;       // offset from yesterday (0 = yesterday)
  label: string;
  volumeMultiplier: number;
  description: string;
}

export const CORPUS_OUTLIERS: OutlierNight[] = [
  { daysAgo: 78, label: "Headliner DJ — DJ Snake", volumeMultiplier: 2.0, description: "Sold-out VIP, 300+ admissions, Dom Pérignon depleted" },
  { daysAgo: 55, label: "Fête nationale weekend", volumeMultiplier: 1.5, description: "Terrace slammed, 3 incidents, 2 walkouts" },
  { daysAgo: 30, label: "Dead Saturday (rainstorm)", volumeMultiplier: 0.3, description: "4 sessions only, 2 cancelled orders, staff sent home early" },
  { daysAgo: 7, label: "Velvet Anniversary Party", volumeMultiplier: 1.8, description: "Event-driven, 250 event guests, promoter referrals, comp spike" },
];

/** Returns the outlier multiplier for a night, or 1.0 if no outlier. */
export function outlierMultiplier(d: Date): number {
  const targetIso = isoDate(d);
  for (const o of CORPUS_OUTLIERS) {
    const outlierDate = daysAgo(o.daysAgo);
    if (isoDate(outlierDate) === targetIso) return o.volumeMultiplier;
  }
  return 1.0;
}

// ── Trend: gradual 10% growth over 90 days ──────────────────────────────

export function trendMultiplier(daysAgoValue: number): number {
  return 0.9 + (0.2 * (90 - daysAgoValue) / 90); // 0.9 at day 90 ago, 1.1 at yesterday
}

// ── Guest profile generator ─────────────────────────────────────────────

export interface GeneratedGuestProfile {
  id: string;
  displayName: string;
  firstName: string;
  lastName: string;
  vipTier: "none" | "regular" | "vip";
  tags: string[];
  visitCount: number;
  lifetimeNetCents: number;
  phone: string | null;
  email: string | null;
  status: "active" | "banned";
  banReason: string | null;
}

export function generateGuestProfiles(count: number): GeneratedGuestProfile[] {
  const profiles: GeneratedGuestProfile[] = [];
  for (let i = 0; i < count; i++) {
    const fn = CORPUS_GUEST_FIRST_NAMES[i % CORPUS_GUEST_FIRST_NAMES.length];
    const ln = CORPUS_GUEST_LAST_NAMES[i % CORPUS_GUEST_LAST_NAMES.length];
    const visits = randInt(0, 25);
    const lifetime = visits * randInt(5000, 150000);
    const vipTier = lifetime > 500000 ? "vip" : lifetime > 100000 || visits > 10 ? "regular" : "none";
    const tags: string[] = [];
    if (vipTier === "vip") tags.push("high-spender");
    if (visits > 10) tags.push("regular");
    if (rand() < 0.15) tags.push("industry");
    const status: "active" | "banned" = i === count - 1 ? "banned" : "active";
    profiles.push({
      id: `gp-${fn.toLowerCase()}-${ln.toLowerCase()}`,
      displayName: `${fn} ${ln}`,
      firstName: fn,
      lastName: ln,
      vipTier,
      tags,
      visitCount: visits,
      lifetimeNetCents: lifetime,
      phone: visits > 1 ? `+1 514 555 ${String(i).padStart(4, "0")}` : null,
      email: i < Math.floor(count * 0.6) ? `${fn.toLowerCase()}.${ln.toLowerCase()}@example.com` : null,
      status,
      banReason: status === "banned" ? "Multiple altercations — banned indefinitely" : null,
    });
  }
  return profiles;
}

// ── Reservation name pool ────────────────────────────────────────────────

export const CORPUS_RESERVATION_NAMES = [
  "Dubois party", "Martinez celebration", "Kim birthday", "Chen group",
  "O'Brien corporate", "Nakamura anniversary", "Singh engagement",
  "Thompson reunion", "Garcia bridal", "Wilson launch party",
  "Lefebvre bachelor", "Rossi farewell", "Andersen promotion",
  "Kowalski family", "Ibrahim gathering",
] as const;

// ── Incident templates ───────────────────────────────────────────────────

export interface IncidentTemplate {
  type: string;
  severity: "low" | "medium" | "high";
  narrativeTemplate: string;
  actionsTakenOptions: string[];
}

export const CORPUS_INCIDENT_TEMPLATES: IncidentTemplate[] = [
  { type: "altercation", severity: "medium", narrativeTemplate: "Physical altercation reported in {zone}. Security responded within {minutes} minutes.", actionsTakenOptions: ["Parties separated, no further action", "Guest removed from venue", "Police notified", "Manager reviewed footage"] },
  { type: "medical", severity: "low", narrativeTemplate: "Guest reported {symptom} in {zone}. Staff provided assistance.", actionsTakenOptions: ["First aid administered on site", "EMS called — guest transported", "Guest recovered and returned to table", "Incident logged, no further action"] },
  { type: "refused-entry", severity: "low", narrativeTemplate: "Party of {size} refused entry at door. Reason: {reason}.", actionsTakenOptions: ["ID check failed — underage", "Intoxication — advised to return another night", "Dress code violation", "Aggressive behavior at door"] },
  { type: "theft", severity: "medium", narrativeTemplate: "Guest reported missing {item} at {zone}. Last seen approximately {time}.", actionsTakenOptions: ["CCTV footage reviewed", "Security sweep conducted", "Police report filed", "Item recovered — returned to guest"] },
  { type: "property-damage", severity: "medium", narrativeTemplate: "Property damage reported in {zone}: {item} broken. Estimated cost: ${cost}.", actionsTakenOptions: ["Cleaned and cordoned off", "Guest charged for damages", "Insurance claim filed", "Repaired same night"] },
  { type: "other", severity: "low", narrativeTemplate: "Unusual incident in {zone}. Details: {details}.", actionsTakenOptions: ["Situation monitored", "Manager debriefed team", "Written warning issued", "No further action"] },
];

// ── Staff action helpers ─────────────────────────────────────────────────

/** Staff eligible to work on a given night (based on their night roster). */
export function staffOnNight(d: Date): CorpusStaffMember[] {
  const dow = d.getDay();
  return CORPUS_ROSTER.filter((s) => s.nights.includes(dow));
}

/** Non-manager staff eligible for order delivery. Zone-filtered. */
export function deliveryStaffForZone(zoneId: string, d: Date): CorpusStaffMember[] {
  const onNight = staffOnNight(d).filter((s) => s.role !== "manager");
  return onNight.filter((s) =>
    s.assignedZoneIds.length === 0 || s.assignedZoneIds.includes(zoneId)
  );
}

/** Runners on a given night (they handle help requests). */
export function runnersOnNight(d: Date): CorpusStaffMember[] {
  return staffOnNight(d).filter((s) => s.role === "runner");
}

// ── Venue config builder (produces the shape Venue type expects) ────────

export function buildCorpusVenueConfig() {
  return {
    ...CORPUS_VENUE,
  };
}

// ── Modifier groups ────────────────────────────────────────────────────

// ── Modifier groups ────────────────────────────────────────────────────

export interface CorpusModifierOption {
  id: string;
  name: string;
  priceDelta: number;
  maxQuantity: number;
  inventoryItemId?: string;
  isActive: boolean;
}

export interface CorpusModifierGroup {
  id: string;
  name: string;
  kind: "washer" | "presentation";
  required: boolean;
  maxSelections: number;
  isActive: boolean;
  options: CorpusModifierOption[];
}

const mk = (id: string, name: string, priceDelta: number, maxQty: number, itemId?: string): CorpusModifierOption =>
  ({ id, name, priceDelta, maxQuantity: maxQty, inventoryItemId: itemId, isActive: true });

export const CORPUS_MODIFIER_GROUPS: Record<string, CorpusModifierGroup> = {
  presentation: {
    id: "mod-presentation", name: "Presentation", kind: "presentation", required: false, maxSelections: 1, isActive: true,
    options: [
      { id: "pr-1", name: "Standard service", priceDelta: 0, maxQuantity: 1, isActive: true },
      { id: "pr-2", name: "Sparkler parade", priceDelta: 25, maxQuantity: 1, isActive: true },
      { id: "pr-3", name: "LED sign + parade", priceDelta: 60, maxQuantity: 1, isActive: true },
    ],
  },
  washersChampagne: {
    id: "mod-washers-champagne", name: "Washers", kind: "washer", required: true, maxSelections: 2, isActive: true,
    options: [mk("ch-wa-1", "Cranberry Juice", 0, 6, "mi-cranberry-juice"), mk("ch-wa-2", "Orange Juice", 0, 6, "mi-orange-juice"), mk("ch-wa-3", "Red Bull", 5, 6, "mi-redbull"), mk("ch-wa-4", "Red Bull 6-pack", 30, 3, "mi-redbull-6pack"), mk("ch-wa-5", "Spring Water 12-pack", 20, 2, "mi-spring-water-12")],
  },
  washersTequila: {
    id: "mod-washers-tequila", name: "Washers", kind: "washer", required: true, maxSelections: 2, isActive: true,
    options: [mk("te-wa-1", "Sprite", 0, 6, "mi-sprite"), mk("te-wa-2", "Pineapple Juice", 0, 6, "mi-pineapple-juice"), mk("te-wa-3", "Orange Juice", 0, 6, "mi-orange-juice"), mk("te-wa-4", "Red Bull", 5, 6, "mi-redbull"), mk("te-wa-5", "Red Bull 6-pack", 30, 3, "mi-redbull-6pack"), mk("te-wa-6", "Spring Water 12-pack", 20, 2, "mi-spring-water-12")],
  },
  washersVodka: {
    id: "mod-washers-vodka", name: "Washers", kind: "washer", required: true, maxSelections: 2, isActive: true,
    options: [mk("vo-wa-1", "Cranberry Juice", 0, 6, "mi-cranberry-juice"), mk("vo-wa-2", "Sprite", 0, 6, "mi-sprite"), mk("vo-wa-3", "Tonic Water", 0, 6, "mi-tonic-water"), mk("vo-wa-4", "Ginger Ale", 0, 6, "mi-gingerale"), mk("vo-wa-5", "Red Bull", 5, 6, "mi-redbull"), mk("vo-wa-6", "Red Bull 6-pack", 30, 3, "mi-redbull-6pack"), mk("vo-wa-7", "Spring Water 12-pack", 20, 2, "mi-spring-water-12")],
  },
  washersCognac: {
    id: "mod-washers-cognac", name: "Washers", kind: "washer", required: true, maxSelections: 2, isActive: true,
    options: [mk("co-wa-1", "Coca-Cola", 0, 6, "mi-coke"), mk("co-wa-2", "Ginger Ale", 0, 6, "mi-gingerale"), mk("co-wa-3", "Spring Water 12-pack", 20, 2, "mi-spring-water-12"), mk("co-wa-4", "Red Bull", 5, 6, "mi-redbull")],
  },
  washersRhum: {
    id: "mod-washers-rhum", name: "Washers", kind: "washer", required: true, maxSelections: 2, isActive: true,
    options: [mk("rh-wa-1", "Coca-Cola", 0, 6, "mi-coke"), mk("rh-wa-2", "Sprite", 0, 6, "mi-sprite"), mk("rh-wa-3", "Pineapple Juice", 0, 6, "mi-pineapple-juice"), mk("rh-wa-4", "Orange Juice", 0, 6, "mi-orange-juice"), mk("rh-wa-5", "Red Bull", 5, 6, "mi-redbull"), mk("rh-wa-6", "Red Bull 6-pack", 30, 3, "mi-redbull-6pack")],
  },
  washersWhisky: {
    id: "mod-washers-whisky", name: "Washers", kind: "washer", required: true, maxSelections: 2, isActive: true,
    options: [mk("wh-wa-1", "Coca-Cola", 0, 6, "mi-coke"), mk("wh-wa-2", "Ginger Ale", 0, 6, "mi-gingerale"), mk("wh-wa-3", "Spring Water 12-pack", 20, 2, "mi-spring-water-12")],
  },
  washersGin: {
    id: "mod-washers-gin", name: "Washers", kind: "washer", required: true, maxSelections: 2, isActive: true,
    options: [mk("gi-wa-1", "Tonic Water", 0, 6, "mi-tonic-water"), mk("gi-wa-2", "Sprite", 0, 6, "mi-sprite"), mk("gi-wa-3", "Cranberry Juice", 0, 6, "mi-cranberry-juice"), mk("gi-wa-4", "Red Bull", 5, 6, "mi-redbull"), mk("gi-wa-5", "Red Bull 6-pack", 30, 3, "mi-redbull-6pack")],
  },
  washersPackage: {
    id: "mod-washers-package", name: "Washers", kind: "washer", required: true, maxSelections: 2, isActive: true,
    options: [mk("pk-wa-1", "Coca-Cola", 0, 6, "mi-coke"), mk("pk-wa-2", "Sprite", 0, 6, "mi-sprite"), mk("pk-wa-3", "Cranberry Juice", 0, 6, "mi-cranberry-juice"), mk("pk-wa-4", "Pineapple Juice", 0, 6, "mi-pineapple-juice"), mk("pk-wa-5", "Orange Juice", 0, 6, "mi-orange-juice"), mk("pk-wa-6", "Tonic Water", 0, 6, "mi-tonic-water"), mk("pk-wa-7", "Ginger Ale", 0, 6, "mi-gingerale"), mk("pk-wa-8", "Red Bull", 5, 6, "mi-redbull"), mk("pk-wa-9", "Red Bull 6-pack", 30, 3, "mi-redbull-6pack"), mk("pk-wa-10", "Spring Water 12-pack", 20, 2, "mi-spring-water-12")],
  },
};

/** Washer group ID for each menu category. */
export const CATEGORY_WASHER_MAP: Record<string, string> = {
  "cat-champagne": "mod-washers-champagne",
  "cat-tequila": "mod-washers-tequila",
  "cat-vodka": "mod-washers-vodka",
  "cat-cognac": "mod-washers-cognac",
  "cat-rhum": "mod-washers-rhum",
  "cat-whisky": "mod-washers-whisky",
  "cat-gin": "mod-washers-gin",
};

// ── Bottle packages ──────────────────────────────────────────────────────

export interface CorpusPackage {
  id: string;
  name: string;
  description: string;
  price: number;
  components: { menuItemId: string; quantity: number }[];
  modifierGroupKeys: string[]; // keys into CORPUS_MODIFIER_GROUPS
  isActive: boolean;
}

export const CORPUS_PACKAGES: CorpusPackage[] = [
  {
    id: "pkg-mr-ace", name: "Mr Ace",
    description: "The statement order: five gold bottles paraded to your booth with LED.",
    price: 2400, components: [{ menuItemId: "mi-ace", quantity: 5 }],
    modifierGroupKeys: ["washersPackage", "presentation"], isActive: true,
  },
  {
    id: "pkg-presidential", name: "The Presidential",
    description: "Cristal and Cognac X.O for a table that knows what it wants.",
    price: 1600, components: [{ menuItemId: "mi-cristal", quantity: 2 }, { menuItemId: "mi-remy", quantity: 1 }],
    modifierGroupKeys: ["washersPackage", "presentation"], isActive: true,
  },
  {
    id: "pkg-agave-royale", name: "Agave Royale",
    description: "Clase Azul meets 1942 — the tequila celebration set.",
    price: 700, components: [{ menuItemId: "mi-clase-azul", quantity: 1 }, { menuItemId: "mi-don-julio", quantity: 1 }],
    modifierGroupKeys: ["washersPackage", "presentation"], isActive: true,
  },
  {
    id: "pkg-table-starter", name: "Table Starter",
    description: "Everything a table needs: Grey Goose, Hennessy, and all the mixers.",
    price: 380, components: [{ menuItemId: "mi-greygoose", quantity: 1 }, { menuItemId: "mi-hennessy", quantity: 1 }],
    modifierGroupKeys: ["washersPackage", "presentation"], isActive: true,
  },
  {
    id: "pkg-bubble-bar", name: "Bubble Bar",
    description: "Moët tower — three bottles, sparkler parade included.",
    price: 450, components: [{ menuItemId: "mi-moet", quantity: 3 }],
    modifierGroupKeys: ["washersChampagne", "presentation"], isActive: true,
  },
  {
    id: "pkg-magnum-club", name: "Magnum Club",
    description: "Belvedere magnum with the full washer spread.",
    price: 350, components: [{ menuItemId: "mi-belvedere", quantity: 2 }],
    modifierGroupKeys: ["washersVodka", "presentation"], isActive: true,
  },
  {
    id: "pkg-legacy", name: "Legacy",
    description: "The ultimate: Cristal, Blue Label, 1942, X.O. The booth that wants it all.",
    price: 24000, components: [
      { menuItemId: "mi-cristal", quantity: 3 }, { menuItemId: "mi-jw-blue", quantity: 2 },
      { menuItemId: "mi-don-julio", quantity: 2 }, { menuItemId: "mi-remy", quantity: 2 },
      { menuItemId: "mi-redbull-6pack", quantity: 4 }, { menuItemId: "mi-spring-water-12", quantity: 2 },
    ],
    modifierGroupKeys: ["washersPackage", "presentation"], isActive: true,
  },
];

// ── Happy hour rules ─────────────────────────────────────────────────────

export interface CorpusHappyHourRule {
  id: string;
  name: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  discountPct: number;
  appliesToCategoryIds: string[];
  isActive: boolean;
}

export const CORPUS_HAPPY_HOUR_RULES: CorpusHappyHourRule[] = [
  {
    id: "hh-thu-champagne", name: "Thursday Champagne Hour",
    daysOfWeek: [4], startTime: "22:00", endTime: "23:30", discountPct: 20,
    appliesToCategoryIds: ["cat-champagne"], isActive: true,
  },
  {
    id: "hh-fri-early", name: "Friday Early Bird",
    daysOfWeek: [5], startTime: "22:00", endTime: "23:00", discountPct: 15,
    appliesToCategoryIds: ["cat-vodka", "cat-tequila"], isActive: true,
  },
  {
    id: "hh-sat-late", name: "Saturday Late Night",
    daysOfWeek: [6], startTime: "03:00", endTime: "05:00", discountPct: 25,
    appliesToCategoryIds: ["cat-champagne", "cat-cognac"], isActive: true,
  },
];

// ── Menu item helpers ────────────────────────────────────────────────────

const ALCOHOLIC_ITEMS = CORPUS_MENU_ITEMS.filter((i) => i.isAlcoholic && i.inventory > 0);
const WASHER_ITEMS = CORPUS_MENU_ITEMS.filter((i) => !i.isAlcoholic);

/** Build a realistic bottle order: 1–3 spirit bottles + optional washers + optional presentation. */
function generateOrderItems(
  sessionId: string,
  orderIndex: number,
): { items: Array<Record<string, unknown>>; subtotal: number } {
  const bottleCount = rand() < 0.3 ? 2 : rand() < 0.1 ? 3 : 1;
  const bottles = pickDistinct([...ALCOHOLIC_ITEMS], bottleCount);
  const items: Array<Record<string, unknown>> = [];
  let subtotal = 0;

  for (const bottle of bottles) {
    const qty = 1; // bottles are sold by the unit
    const itemTotal = bottle.price * qty * 100; // cents
    subtotal += itemTotal;

    const modifiers: Array<Record<string, unknown>> = [];
    // Add 1–2 washers for spirit categories
    if (bottle.categoryId !== "cat-champagne" && rand() < 0.8) {
      const washerCount = randInt(1, 2);
      const washerOpts = pickDistinct(WASHER_ITEMS, washerCount);
      for (const w of washerOpts) {
        modifiers.push({
          groupId: `mod-washers-${bottle.categoryId.split("-")[1]}`,
          optionId: `wa-${w.id}`,
          kind: "washer",
          groupName: "Washers",
          optionName: w.name,
        });
        subtotal += w.price * 100;
      }
    }
    // 15% chance of presentation upgrade
    if (rand() < 0.15) {
      const pres = pick(CORPUS_MODIFIER_GROUPS.presentation.options.filter((o) => o.priceDelta > 0));
      modifiers.push({
        groupId: "mod-presentation",
        optionId: pres.id,
        kind: "presentation",
        groupName: "Presentation",
        optionName: pres.name,
      });
      subtotal += pres.priceDelta * 100;
    }

    items.push({
      id: `oi-${sessionId}-${orderIndex}-${bottle.id}`,
      menuItemId: bottle.id,
      name: bottle.name,
      quantity: qty,
      unitPrice: bottle.price,
      modifiers,
    });
  }

  return { items, subtotal };
}

// ── Night activity generator ─────────────────────────────────────────────

export interface GeneratedSession {
  id: string;
  tableId: string;
  tableCode: string;
  zoneId: string;
  zoneName: string;
  displayName: string;
  partySize: number;
  status: string;
  createdAt: string;
  settledExternallyAt?: string;
  settlementMethod?: string;
  minimumSpendCents?: number;
  guestProfileId?: string;
}

export interface GeneratedOrder {
  id: string;
  code: string;
  venueId: string;
  sessionId: string;
  tableId: string;
  tableCode: string;
  zoneId: string;
  zoneName: string;
  guestName: string;
  items: Array<Record<string, unknown>>;
  subtotal: number;
  serviceFee: number;
  feeBreakdown: Array<{ fee: { id: string; name: string; type: string; value: number }; amount: number }>;
  tip: number;
  total: number;
  status: string;
  placedAt: string;
  updatedAt: string;
  acceptedAt?: string;
  claimedByStaffId?: string;
  claimedByStaffName?: string;
}

export interface GeneratedHelpRequest {
  id: string;
  sessionId: string;
  tableCode: string;
  zoneId: string;
  zoneName: string;
  guestName: string;
  type: string;
  status: string;
  createdAt: string;
  resolvedByStaffId?: string;
  resolvedByStaffName?: string;
}

export interface GeneratedIncident {
  id: string;
  venueId: string;
  businessDate: string;
  type: string;
  severity: string;
  occurredAt: string;
  zoneId?: string;
  locationDescription?: string;
  guestProfileId?: string;
  involvedStaffIds: string[];
  narrative: string;
  actionsTaken: string;
  policeInvolved: boolean;
  reportedByStaffId: string;
  reportedByStaffName: string;
  status: string;
  reportable: boolean;
}

export interface GeneratedReservation {
  id: string;
  venueId: string;
  tableId?: string;
  zoneId?: string;
  eventId?: string;
  guestName: string;
  partySize: number;
  startsAt: string;
  endsAt?: string;
  status: string;
  note?: string;
  source: string;
  channel?: string;
  guestEmail?: string;
  guestPhone?: string;
  reservationPin?: string;
  guestProfileId?: string;
  seatingNumber?: number;
  minimumSpendCents?: number;
  packageId?: string;
}

export interface GeneratedEvent {
  id: string;
  venueId: string;
  name: string;
  description: string;
  startsAt: string;
  endsAt: string;
  zoneId?: string;
  capacity: number;
  status: string;
  guestlistEnabled: boolean;
  eventGuests: Array<{ id: string; name: string; partySize: number; status: string; promoterId?: string }>;
  talent: Array<{
    id: string; name: string; role: string;
    setTimes: Array<{ start: string; end: string }>;
    status: string;
  }>;
}

export interface GeneratedPromotion {
  id: string;
  venueId: string;
  code: string;
  name: string;
  type: string;
  value: number;
  appliesToCategoryIds: string[];
  startsAt: string;
  endsAt: string;
  status: string;
  redemptionCount: number;
}

export interface GeneratedAdmission {
  id: string;
  venueId: string;
  businessDate: string;
  guestProfileId?: string;
  partySize: number;
  admissionType: string;
  amountOwedCents: number;
  source: string;
  admittedByStaffId: string;
  admittedByStaffName: string;
  admittedAt: string;
  exitedAt?: string;
}

export interface GeneratedWaitlistEntry {
  id: string;
  venueId: string;
  name: string;
  partySize: number;
  phone?: string;
  quotedMinutes: number;
  status: string;
  joinedAt: string;
  notifiedAt?: string;
}

export interface GeneratedOccupancyEvent {
  id: string;
  venueId: string;
  businessDate: string;
  delta: number;
  reason: string;
  staffId: string;
  at: string;
}

export interface GeneratedCoatCheckTicket {
  id: string;
  venueId: string;
  businessDate: string;
  ticketNumber: number;
  itemCount: number;
  checkedInAt: string;
  claimedAt?: string;
  staffId: string;
}

export interface NightActivity {
  nightDate: string;
  sessions: GeneratedSession[];
  orders: GeneratedOrder[];
  helpRequests: GeneratedHelpRequest[];
  incidents: GeneratedIncident[];
  stockMovements: Array<Record<string, unknown>>;
  admissions: GeneratedAdmission[];
  waitlistEntries: GeneratedWaitlistEntry[];
  occupancyEvents: GeneratedOccupancyEvent[];
  coatCheckTickets: GeneratedCoatCheckTicket[];
}

/** Build a fee breakdown from venue fee config, applied to a subtotal in cents. */
export function computeFeeBreakdown(
  subtotalCents: number,
  fees: ReadonlyArray<{ id: string; name: string; type: string; value: number }>,
): Array<{ fee: { id: string; name: string; type: string; value: number }; amount: number }> {
  return fees.map((fee) => {
    const amount = fee.type === "percentage"
      ? Math.round(subtotalCents * fee.value / 100)
      : fee.value * 100;
    return { fee: { id: fee.id, name: fee.name, type: fee.type, value: fee.value }, amount };
  });
}

/** Total fees in cents. */
export function totalFeeCents(subtotalCents: number): number {
  const breakdown = computeFeeBreakdown(subtotalCents, CORPUS_VENUE.serviceFees);
  return breakdown.reduce((sum, f) => sum + f.amount, 0);
}

/**
 * Generate the full activity for one business night. This is the primary
 * function imported by both demo mock-data.ts and live seed scripts.
 *
 * Produces sessions, orders, help requests, incidents, stock movements,
 * admissions, waitlist, occupancy, and coat check for the given date.
 */
export function generateNightActivity(nightDate: Date): NightActivity {
  const nightDateStr = isoDate(nightDate);
  const openDay = DAY_NAMES[nightDate.getDay()];
  const openingHour = CORPUS_VENUE.openingHours.find((h) => h.day === openDay);
  const openTime = openingHour ? parseInt(openingHour.open) : 22;
  const closeTime = openingHour ? parseInt(openingHour.close) : 4;

  // Time helper: generate ISO timestamps within the venue's open hours
  const hourInNight = (h: number): string => {
    const d = new Date(nightDate);
    d.setHours(h, randInt(0, 59), randInt(0, 59), 0);
    return d.toISOString();
  };

  // Volume calculation
  const baseVol = nightVolumeMultiplier(nightDate);
  const outlier = outlierMultiplier(nightDate);
  const vol = baseVol * outlier;

  const sessionCount = Math.max(1, Math.round(baseSessionsForNight(nightDate) * outlier));
  const onStaff = staffOnNight(nightDate);
  const manager = onStaff.find((s) => s.role === "manager") ?? CORPUS_ROSTER[0];
  const nonManagerStaff = onStaff.filter((s) => s.role !== "manager");

  const sessions: GeneratedSession[] = [];
  const orders: GeneratedOrder[] = [];
  const helpRequests: GeneratedHelpRequest[] = [];
  const incidents: GeneratedIncident[] = [];
  const stockMovements: Array<Record<string, unknown>> = [];
  const admissions: GeneratedAdmission[] = [];
  const waitlistEntries: GeneratedWaitlistEntry[] = [];
  const occupancyEvents: GeneratedOccupancyEvent[] = [];
  const coatCheckTickets: GeneratedCoatCheckTicket[] = [];

  // Occupancy tracking — kept via occupancyEvents array

  for (let s = 0; s < sessionCount; s++) {
    const table = pick(CORPUS_TABLES);
    const zone = CORPUS_ZONES.find((z) => z.id === table.zoneId) ?? CORPUS_ZONES[0];
    const seatHour = openTime + randInt(0, Math.min(3, closeTime > openTime ? closeTime - openTime - 1 : 2));
    const createdAt = hourInNight(seatHour);
    const partySize = randInt(1, table.seats);
    const guestName = `${pick(CORPUS_GUEST_FIRST_NAMES)} ${pick(CORPUS_GUEST_LAST_NAMES)}`;
    const sessionId = `sess-${nightDateStr}-${s + 1}`;

    // ~10% cancelled/denied, ~5% walkout (closed without settlement)
    const fate = rand();
    let sessionStatus: string;
    let settledExternallyAt: string | undefined;
    let settlementMethod: string | undefined;

    if (fate < 0.05) sessionStatus = "denied";
    else if (fate < 0.10) sessionStatus = "pending";
    else if (fate < 0.15) { sessionStatus = "closed"; settlementMethod = "cash"; settledExternallyAt = hourInNight(seatHour + randInt(2, 5)); }
    else sessionStatus = "approved";

    // For closed sessions, some are settled via terminal/cash/house
    if (sessionStatus === "approved" && rand() < 0.3) {
      sessionStatus = "closed";
      settlementMethod = pick([...CORPUS_SETTLEMENT_METHODS]);
      settledExternallyAt = hourInNight(seatHour + randInt(2, 5));
    }

    sessions.push({
      id: sessionId, tableId: table.id, tableCode: table.code, zoneId: zone.id, zoneName: zone.name,
      displayName: guestName, partySize, status: sessionStatus, createdAt,
      settledExternallyAt, settlementMethod,
      minimumSpendCents: table.minimumSpend ? table.minimumSpend * 100 : undefined,
    });

    // Orders for this session (0–4 per session, depending on status)
    const orderCount = sessionStatus === "denied" || sessionStatus === "pending" ? 0
      : sessionStatus === "closed" && settlementMethod === "cash" ? randInt(1, 2)
      : randInt(1, 4);

    let sessionOrderIdx = 0;
    for (let o = 0; o < orderCount; o++) {
      sessionOrderIdx++;
      const globalIdx = orders.length + 1;
      const orderId = `ord-${nightDateStr}-${globalIdx}`;
      const code = `A-${String(globalIdx).padStart(3, "0")}`;
      const placedHour = seatHour + o;
      const placedAt = hourInNight(Math.min(placedHour, closeTime > openTime ? closeTime - 1 : openTime + 3));
      const { items, subtotal: subtotalCents } = generateOrderItems(sessionId, sessionOrderIdx);

      // Fee math routes through the real ordering/fees.ts so seeded orders
      // match what the live app computes — no drift between seed data and runtime.
      const subtotalDollars = subtotalCents / 100;
      const feeTotal = Math.round(computeServiceFee(subtotalDollars, CORPUS_VENUE as unknown as Venue) * 100);
      const feeLines = computeFeeLines(subtotalDollars, CORPUS_VENUE as unknown as Venue);
      const feeBreakdown = feeLines.map((l) => ({
        fee: { id: l.fee.id, name: l.fee.name, type: l.fee.type, value: l.fee.value },
        amount: Math.round(l.amount * 100),
      }));
      const tipPct = pick([15, 15, 20, 20, 25]); // weighted toward 15-20
      const tipCents = Math.round(subtotalCents * tipPct / 100);
      const totalCents = subtotalCents + feeTotal + tipCents;

      // Order status — most delivered, some still in-flight for "today"
      let orderStatus: string;
      if (nightDateStr === isoDate(today()) || nightDateStr === isoDate(yesterday())) {
        // Recent nights: mix of statuses including in-flight
        orderStatus = pick(["accepted", "preparing", "ready", "delivered", "delivered", "delivered"]);
      } else {
        // Historical: mostly delivered
        orderStatus = rand() < 0.85 ? "delivered" : "cancelled";
      }

      const claimedStaff = pick(nonManagerStaff.length > 0 ? nonManagerStaff : CORPUS_ROSTER);

      orders.push({
        id: orderId, code, venueId: CORPUS_VENUE.id,
        sessionId, tableId: table.id, tableCode: table.code,
        zoneId: zone.id, zoneName: zone.name, guestName,
        items,
        subtotal: Math.round(subtotalCents / 100 * 100) / 100,
        serviceFee: Math.round(feeTotal / 100 * 100) / 100,
        feeBreakdown,
        tip: Math.round(tipCents / 100 * 100) / 100,
        total: Math.round(totalCents / 100 * 100) / 100,
        status: orderStatus,
        placedAt,
        updatedAt: orderStatus === "delivered" || orderStatus === "cancelled"
          ? hourInNight(Math.min(placedHour + randInt(1, 3), 23))
          : placedAt,
        acceptedAt: orderStatus !== "pending" && orderStatus !== "cancelled"
          ? hourInNight(Math.min(placedHour + 1, 23))
          : undefined,
        claimedByStaffId: claimedStaff.id,
        claimedByStaffName: claimedStaff.name,
      });

      // Stock movements for each alcoholic order item
      for (const item of items) {
        const menuItem = CORPUS_MENU_ITEMS.find((mi) => mi.id === item.menuItemId);
        if (menuItem && menuItem.isAlcoholic && typeof item.quantity === "number") {
          stockMovements.push({
            id: `sm-${orderId}-${item.menuItemId}`,
            menuItemId: item.menuItemId,
            itemName: item.name,
            type: "sale",
            delta: -(item.quantity as number),
            note: `Order ${code}`,
            createdAt: placedAt,
          });
        }
      }
    }

    // Help requests: ~30% of sessions have at least one
    if (rand() < 0.3 && sessionStatus === "approved") {
      const helpCount = randInt(1, 2);
      for (let h = 0; h < helpCount; h++) {
        const helpType = pick([...CORPUS_HELP_TYPES]);
        const helpCreatedAt = hourInNight(seatHour + randInt(0, 4));
        const resolved = rand() < 0.7;
        const runner = pick(runnersOnNight(nightDate).length > 0 ? runnersOnNight(nightDate) : CORPUS_ROSTER);
        helpRequests.push({
          id: `help-${nightDateStr}-${s}-${h}`,
          sessionId, tableCode: table.code, zoneId: zone.id, zoneName: zone.name,
          guestName, type: helpType,
          status: resolved ? "resolved" : "pending",
          createdAt: helpCreatedAt,
          resolvedByStaffId: resolved ? runner.id : undefined,
          resolvedByStaffName: resolved ? runner.name : undefined,
        });
      }
    }
  }

  // Incidents: 0–2 per night depending on volume
  const incidentCount = vol > 1.5 ? randInt(1, 2) : vol > 0.8 ? (rand() < 0.5 ? 1 : 0) : 0;
  const securityStaff = staffOnNight(nightDate).find((s) => s.role === "security") ?? CORPUS_ROSTER[9];
  for (let i = 0; i < incidentCount; i++) {
    const template = pick(CORPUS_INCIDENT_TEMPLATES);
    const zone = pick(CORPUS_ZONES);
    const narrative = template.narrativeTemplate
      .replace("{zone}", zone.name)
      .replace("{minutes}", String(randInt(2, 8)))
      .replace("{symptom}", pick(["dizziness", "nausea", "dehydration", "fatigue"]))
      .replace("{size}", String(randInt(2, 8)))
      .replace("{reason}", pick(["Underage ID presented", "Visible intoxication", "Aggressive behavior at door", "Dress code violation"]))
      .replace("{item}", pick(["iPhone", "wallet", "handbag", "watch"]))
      .replace("{time}", `${randInt(22, 3)}:${String(randInt(0, 59)).padStart(2, "0")}`)
      .replace("{cost}", String(randInt(50, 500)))
      .replace("{details}", pick(["Guest complaint resolved at table", "Minor verbal dispute", "Unattended bag reported"]));

    incidents.push({
      id: `inc-${nightDateStr}-${i + 1}`,
      venueId: CORPUS_VENUE.id,
      businessDate: nightDateStr,
      type: template.type,
      severity: template.severity,
      occurredAt: hourInNight(openTime + randInt(1, Math.max(1, closeTime > openTime ? closeTime - openTime - 1 : 3))),
      zoneId: zone.id,
      locationDescription: `Near ${zone.name}, ${pick(["east", "west", "north", "south", "center"])} side`,
      involvedStaffIds: [securityStaff.id],
      narrative,
      actionsTaken: pick(template.actionsTakenOptions),
      policeInvolved: template.type === "theft" && rand() < 0.3,
      reportedByStaffId: securityStaff.id,
      reportedByStaffName: securityStaff.name,
      status: rand() < 0.7 ? "resolved" : "open",
      reportable: template.severity === "high",
    });
  }

  // Admissions: every session party gets an admission event
  for (const sess of sessions) {
    if (sess.status === "denied" || sess.status === "pending") continue;
    const adHour = openTime + randInt(0, 2);
    const staff = pick(nonManagerStaff.length > 0 ? nonManagerStaff : CORPUS_ROSTER);
    admissions.push({
      id: `adm-${sess.id}`,
      venueId: CORPUS_VENUE.id,
      businessDate: nightDateStr,
      partySize: sess.partySize,
      admissionType: pick(["general", "guestlist", "vip", "general", "general", "guestlist"]),
      amountOwedCents: rand() < 0.7 ? 0 : randInt(1000, 4000), // most free, some cover
      source: pick(["door", "online", "door", "door", "promoter"]),
      admittedByStaffId: staff.id,
      admittedByStaffName: staff.name,
      admittedAt: hourInNight(adHour),
    });

    occupancyEvents.push({
      id: `oe-${sess.id}`,
      venueId: CORPUS_VENUE.id,
      businessDate: nightDateStr,
      delta: sess.partySize,
      reason: "admission",
      staffId: staff.id,
      at: hourInNight(adHour),
    });
  }

  // Waitlist: 2–8 entries depending on volume
  const waitlistCount = Math.round(randInt(2, 4) * vol);
  for (let w = 0; w < waitlistCount; w++) {
    const wlName = `${pick(CORPUS_GUEST_FIRST_NAMES)} ${pick(CORPUS_GUEST_LAST_NAMES)}`;
    const seated = rand() < 0.6; // 60% eventually seated
    waitlistEntries.push({
      id: `wl-${nightDateStr}-${w + 1}`,
      venueId: CORPUS_VENUE.id,
      name: wlName,
      partySize: randInt(1, 8),
      phone: rand() < 0.5 ? `+1 514 555 ${String(randInt(0, 9999)).padStart(4, "0")}` : undefined,
      quotedMinutes: randInt(15, 45),
      status: seated ? "seated" : rand() < 0.5 ? "left" : "expired",
      joinedAt: hourInNight(openTime + randInt(0, 3)),
      notifiedAt: seated ? hourInNight(openTime + randInt(1, 4)) : undefined,
    });
  }

  // Coat check: ~40% of sessions use coat check
  if (CORPUS_VENUE.coatCheckEnabled) {
    let ticketNum = randInt(100, 999);
    for (const sess of sessions) {
      if (sess.status === "denied" || sess.status === "pending") continue;
      if (rand() > 0.4) continue;
      ticketNum++;
      const checkedIn = hourInNight(openTime + randInt(0, 2));
      coatCheckTickets.push({
        id: `cc-${sess.id}`,
        venueId: CORPUS_VENUE.id,
        businessDate: nightDateStr,
        ticketNumber: ticketNum,
        itemCount: randInt(1, sess.partySize),
        checkedInAt: checkedIn,
        claimedAt: sess.status === "closed" ? hourInNight(openTime + randInt(3, 6)) : undefined,
        staffId: manager.id,
      });
    }
  }

  return {
    nightDate: nightDateStr,
    sessions, orders, helpRequests, incidents,
    stockMovements, admissions, waitlistEntries, occupancyEvents, coatCheckTickets,
  };
}

// ── Historical events generator ──────────────────────────────────────────

const EVENT_DEFINITIONS = [
  { name: "Guest DJ Set — {artist}", desc: "Special guest DJ set on the main floor. Extended hours.", capacity: 350, guestlist: true, talentRole: "dj" as const },
  { name: "Industry Night", desc: "Half-price bottles for service industry. 50+ industry regulars expected.", capacity: 250, guestlist: true, talentRole: null },
  { name: "{artist} Live Performance", desc: "Live set on the main floor. Full production.", capacity: 380, guestlist: true, talentRole: "performer" as const },
  { name: "VIP Tasting — {spirit}", desc: "Curated tasting flight for VIP members only. Limited to 40 seats.", capacity: 40, guestlist: false, talentRole: "host" as const },
  { name: "Summer Rooftop Series", desc: "Terrace open all night with guest MC.", capacity: 280, guestlist: true, talentRole: "mc" as const },
];

const EVENT_ARTISTS = ["DJ Snake", "Kaytranada", "Tchami", "Malaa", "CRi", "BAMBII", "Zeds Dead", "REZZ", "Adventure Club", "Tiga"];
const EVENT_SPIRITS = ["Hennessy", "Don Julio", "Macallan", "Cristal", "Grey Goose"];

/** Pick nights to place events — ~7 events across 90 days, biased toward weekends. */
function pickEventNights(startDay: number, endDay: number, count: number): number[] {
  const candidates: number[] = [];
  for (let d = startDay; d >= endDay; d--) {
    const date = daysAgo(d);
    if (isOpenNight(date) && isWeekend(date)) candidates.push(d);
    if (isOpenNight(date) && !isWeekend(date) && rand() < 0.3) candidates.push(d);
  }
  // Deterministic pick: sort candidates, take first `count` after shuffling with PRNG
  const shuffled = [...candidates].sort(() => rand() - 0.5);
  const picked = shuffled.slice(0, count).sort((a, b) => b - a); // newest first
  return picked;
}

export function generateHistoricalEvents(): GeneratedEvent[] {
  const eventNights = pickEventNights(89, 0, 7);
  const events: GeneratedEvent[] = [];

  for (const daysOffset of eventNights) {
    const nightDate = daysAgo(daysOffset);
    const nightDateStr = isoDate(nightDate);
    const def = pick(EVENT_DEFINITIONS);
    const openDay = DAY_NAMES[nightDate.getDay()];
    const openingHour = CORPUS_VENUE.openingHours.find((h) => h.day === openDay);
    const openH = openingHour ? parseInt(openingHour.open) : 22;
    const closeH = openingHour ? parseInt(openingHour.close) : 4;
    const startsAt = new Date(nightDate);
    startsAt.setHours(openH, 0, 0, 0);
    const endsAt = new Date(nightDate);
    const endH = closeH > openH ? closeH : closeH + 24;
    endsAt.setHours(endH, 0, 0, 0);
    // If close is past midnight, advance to next day
    if (closeH < openH) endsAt.setDate(endsAt.getDate() + 1);

    const artist = pick(EVENT_ARTISTS);
    const spirit = pick(EVENT_SPIRITS);
    const eventName = def.name.replace("{artist}", artist).replace("{spirit}", spirit);
    const eventId = `evt-${nightDateStr}`;

    // Event guests
    const guestCount = randInt(Math.round(def.capacity * 0.3), def.capacity);
    const eventGuests: GeneratedEvent["eventGuests"] = [];
    for (let g = 0; g < Math.min(guestCount, 30); g++) { // cap at 30 seeded guests
      const fn = pick([...CORPUS_GUEST_FIRST_NAMES]);
      const ln = pick([...CORPUS_GUEST_LAST_NAMES]);
      eventGuests.push({
        id: `eg-${eventId}-${g + 1}`,
        name: `${fn} ${ln}`,
        partySize: randInt(1, 4),
        status: pick(["confirmed", "confirmed", "confirmed", "checked-in", "invited"] as const),
        promoterId: rand() < 0.2 ? pick(CORPUS_ROSTER.filter((s) => s.role === "promoter"))?.id : undefined,
      });
    }

    // Talent
    const talent = def.talentRole ? [{
      id: `tal-${eventId}`,
      name: artist,
      role: def.talentRole,
      setTimes: [{ start: `${openH + 2}:00`, end: `${Math.min(openH + 4, endH > openH ? endH : endH + 24)}:00` }],
      status: "completed" as string,
    }] : [];

    const eventStatus = daysOffset < 14 ? "upcoming" as string : "completed" as string;

    events.push({
      id: eventId, venueId: CORPUS_VENUE.id,
      name: eventName,
      description: def.desc + (def.talentRole ? ` Featuring ${artist}.` : ""),
      startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(),
      zoneId: def.capacity < 100 ? "zone-vip" : undefined,
      capacity: def.capacity, status: eventStatus, guestlistEnabled: def.guestlist,
      eventGuests, talent,
    });
  }

  // Ensure at least one "upcoming" and one "completed" for variety
  if (events.length >= 2) {
    const hasUpcoming = events.some((e) => e.status === "upcoming");
    const hasCompleted = events.some((e) => e.status === "completed");
    if (!hasUpcoming) events[0].status = "upcoming";
    if (!hasCompleted) events[events.length - 1].status = "completed";
  }

  return events;
}

// ── Historical reservations generator ────────────────────────────────────

export function generateHistoricalReservations(): GeneratedReservation[] {
  const reservations: GeneratedReservation[] = [];

  // Generate 2–5 reservations per open night in the past 60 days
  for (let d = 60; d >= 1; d--) {
    const nightDate = daysAgo(d);
    if (!isOpenNight(nightDate)) continue;

    const nightDateStr = isoDate(nightDate);
    const openDay = DAY_NAMES[nightDate.getDay()];
    const openingHour = CORPUS_VENUE.openingHours.find((h) => h.day === openDay);
    const openH = openingHour ? parseInt(openingHour.open) : 22;
    const count = randInt(2, 5);

    for (let r = 0; r < count; r++) {
      const partyName = pick([...CORPUS_RESERVATION_NAMES]);
      const table = pick(CORPUS_TABLES);
      const isVip = table.minimumSpend && table.minimumSpend >= 600;
      const startsAt = new Date(nightDate);
      startsAt.setHours(openH + randInt(0, 2), randInt(0, 3) * 15, 0, 0);
      const endsAt = new Date(startsAt);
      endsAt.setHours(endsAt.getHours() + randInt(2, 4));

      const status = d < 3 ? pick(["confirmed", "pending"]) // recent: still relevant
        : rand() < 0.8 ? "completed" : rand() < 0.5 ? "cancelled" : "no-show";

      reservations.push({
        id: `res-${nightDateStr}-${r + 1}`,
        venueId: CORPUS_VENUE.id,
        tableId: table.id,
        zoneId: table.zoneId,
        guestName: partyName,
        partySize: randInt(2, table.seats),
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        status,
        note: isVip ? "Booth preference noted. VIP host assigned." : undefined,
        source: "manager",
        channel: pick(["walk-in", "direct", "embed", "phone"]),
        guestEmail: rand() < 0.4 ? `${partyName.split(" ")[0].toLowerCase()}@example.com` : undefined,
        guestPhone: rand() < 0.5 ? `+1 514 555 ${String(randInt(0, 9999)).padStart(4, "0")}` : undefined,
        reservationPin: seededPin(`res-${nightDateStr}-${r + 1}`),
        seatingNumber: rand() < 0.2 ? (pick([1, 2]) as 1 | 2) : undefined,
        minimumSpendCents: table.minimumSpend ? table.minimumSpend * 100 : undefined,
        packageId: isVip && rand() < 0.3 ? pick(CORPUS_PACKAGES.filter((p) => p.price < 2000)).id : undefined,
      });
    }
  }

  // Upcoming reservations (next 14 days)
  for (let f = 0; f < 14; f++) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + f + 1);
    if (!isOpenNight(futureDate)) continue;

    const nightDateStr = isoDate(futureDate);
    const count = randInt(1, 4);
    const openDay = DAY_NAMES[futureDate.getDay()];
    const openingHour = CORPUS_VENUE.openingHours.find((h) => h.day === openDay);
    const openH = openingHour ? parseInt(openingHour.open) : 22;

    for (let r = 0; r < count; r++) {
      const partyName = pick([...CORPUS_RESERVATION_NAMES]);
      const table = pick(CORPUS_TABLES);
      const startsAt = new Date(futureDate);
      startsAt.setHours(openH + randInt(0, 2), randInt(0, 3) * 15, 0, 0);
      const endsAt = new Date(startsAt);
      endsAt.setHours(endsAt.getHours() + randInt(2, 4));

      reservations.push({
        id: `res-future-${nightDateStr}-${r + 1}`,
        venueId: CORPUS_VENUE.id,
        tableId: table.id,
        zoneId: table.zoneId,
        guestName: partyName,
        partySize: randInt(2, table.seats),
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        status: rand() < 0.8 ? "confirmed" : "pending",
        source: "manager",
        channel: pick(["direct", "embed", "phone"]),
        guestEmail: rand() < 0.5 ? `${partyName.split(" ")[0].toLowerCase()}@example.com` : undefined,
        guestPhone: rand() < 0.4 ? `+1 514 555 ${String(randInt(0, 9999)).padStart(4, "0")}` : undefined,
        reservationPin: seededPin(`res-future-${nightDateStr}-${r + 1}`),
        minimumSpendCents: table.minimumSpend ? table.minimumSpend * 100 : undefined,
      });
    }
  }

  return reservations;
}

// ── Historical promotions generator ──────────────────────────────────────

export function generateHistoricalPromotions(): GeneratedPromotion[] {
  const promos: GeneratedPromotion[] = [
    {
      id: "promo-welcome10", venueId: CORPUS_VENUE.id,
      code: "WELCOME10", name: "First Visit — 10% Off",
      type: "percentage", value: 10,
      appliesToCategoryIds: ["cat-champagne", "cat-vodka"],
      startsAt: daysAgo(90).toISOString(), endsAt: daysAgo(-30).toISOString(),
      status: "active", redemptionCount: randInt(20, 60),
    },
    {
      id: "promo-vip-20", venueId: CORPUS_VENUE.id,
      code: "VIP20", name: "VIP Member — 20% Off Premium",
      type: "percentage", value: 20,
      appliesToCategoryIds: ["cat-cognac", "cat-whisky", "cat-champagne"],
      startsAt: daysAgo(60).toISOString(), endsAt: daysAgo(-60).toISOString(),
      status: "active", redemptionCount: randInt(10, 30),
    },
    {
      id: "promo-fete-nationale", venueId: CORPUS_VENUE.id,
      code: "FETENAT", name: "Fête Nationale — $50 Off",
      type: "flat", value: 50,
      appliesToCategoryIds: [],
      startsAt: daysAgo(58).toISOString(), endsAt: daysAgo(54).toISOString(),
      status: "expired", redemptionCount: randInt(15, 40),
    },
    {
      id: "promo-anniversary", venueId: CORPUS_VENUE.id,
      code: "VELVET5", name: "Anniversary — 25% Off",
      type: "percentage", value: 25,
      appliesToCategoryIds: [],
      startsAt: daysAgo(10).toISOString(), endsAt: daysAgo(-20).toISOString(),
      status: "active", redemptionCount: randInt(30, 80),
    },
    {
      id: "promo-summer-series", venueId: CORPUS_VENUE.id,
      code: "SUMMER25", name: "Summer Series — 15% Off Terrace",
      type: "percentage", value: 15,
      appliesToCategoryIds: ["cat-tequila", "cat-gin", "cat-rhum"],
      startsAt: daysAgo(3).toISOString(), endsAt: daysAgo(-60).toISOString(),
      status: "scheduled", redemptionCount: 0,
    },
  ];
  return promos;
}

// ── Present-tense generator ("right now" state) ──────────────────────────

export interface PresentTenseState {
  /** Sessions that are still open or pending approval. */
  openSessions: GeneratedSession[];
  /** Orders currently in-flight (not delivered/cancelled). */
  inFlightOrders: GeneratedOrder[];
  /** Help requests not yet resolved. */
  unackedHelp: GeneratedHelpRequest[];
  /** Current waitlist (waiting + notified). */
  activeWaitlist: GeneratedWaitlistEntry[];
  /** Attention items for the manager pulse dashboard. */
  attentionItems: Array<{
    id: string; type: string; severity: string;
    title: string; detail: string; createdAt: string;
    tableId?: string; sessionId?: string;
  }>;
  /** Today's sessions/orders from the current night if it's open hours. */
  tonightActivity: NightActivity | null;
}

/**
 * Generate the "present tense" state — what a staff member sees when they
 * open the app right now. Active sessions, in-flight orders, unresolved
 * help, waitlist, and attention items.
 */
export function generatePresentTense(): PresentTenseState {
  const now = today();

  // Is the venue open right now?
  const openDay = DAY_NAMES[now.getDay()];
  const openingHour = CORPUS_VENUE.openingHours.find((h) => h.day === openDay);
  const venueOpen = openingHour !== undefined;
  const currentHour = now.getHours();
  const openH = openingHour ? parseInt(openingHour.open) : 22;
  const closeH = openingHour ? parseInt(openingHour.close) : 4;
  const isOpenNow = venueOpen && (
    closeH > openH
      ? (currentHour >= openH && currentHour < closeH)
      : (currentHour >= openH || currentHour < closeH)
  );

  // Generate tonight's activity if we're in open hours or about to open
  let tonightActivity: NightActivity | null = null;
  if (isOpenNow) {
    tonightActivity = generateNightActivity(now);
    // Keep some sessions open, orders in-flight
    tonightActivity.sessions.forEach((s) => {
      if (s.status === "closed") s.status = "approved";
      s.settledExternallyAt = undefined;
      s.settlementMethod = undefined;
    });
    tonightActivity.orders.forEach((o) => {
      if (o.status === "delivered" || o.status === "cancelled") {
        o.status = pick(["accepted", "preparing", "ready", "delivered"]);
      }
    });
  }

  const activity = isOpenNow && tonightActivity ? tonightActivity : generateNightActivity(yesterday());

  // Filter to "present tense" state
  const openSessions = activity.sessions.filter((s) =>
    s.status === "approved" || s.status === "pending"
  );

  const inFlightOrders = activity.orders.filter((o) =>
    o.status !== "delivered" && o.status !== "cancelled"
  );

  const unackedHelp = activity.helpRequests.filter((h) =>
    h.status === "pending"
  );

  const activeWaitlist = activity.waitlistEntries.filter((w) =>
    w.status === "waiting" || w.status === "notified"
  );

  // Attention items — things the manager needs to see
  const attentionItems: PresentTenseState["attentionItems"] = [];

  // SLA-busting orders
  const bustedOrders = activity.orders.filter((o) => {
    if (o.status === "delivered" || o.status === "cancelled") return false;
    const age = (Date.now() - new Date(o.placedAt).getTime()) / 60_000;
    return age > CORPUS_VENUE.slaThresholds.orderCriticalMinutes;
  });
  for (const o of bustedOrders.slice(0, 3)) {
    attentionItems.push({
      id: `att-order-${o.id}`, type: "sla-breach", severity: "high",
      title: `Order ${o.code} overdue`,
      detail: `Table ${o.tableCode}: ${o.guestName} — placed ${Math.round((Date.now() - new Date(o.placedAt).getTime()) / 60_000)} min ago`,
      createdAt: minsAgo(randInt(15, 45)),
      sessionId: o.sessionId,
    });
  }

  // Unacknowledged help that's overdue
  const bustedHelp = unackedHelp.filter((h) => {
    const age = (Date.now() - new Date(h.createdAt).getTime()) / 60_000;
    return age > CORPUS_VENUE.slaThresholds.helpCriticalMinutes;
  });
  for (const h of bustedHelp.slice(0, 2)) {
    attentionItems.push({
      id: `att-help-${h.id}`, type: "unacked-help", severity: "medium",
      title: `Unanswered ${h.type} at ${h.tableCode}`,
      detail: `Guest ${h.guestName} requesting ${h.type} — ${Math.round((Date.now() - new Date(h.createdAt).getTime()) / 60_000)} min ago`,
      createdAt: minsAgo(randInt(5, 15)),
      sessionId: h.sessionId,
    });
  }

  // Occupancy warning if near capacity
  const totalOcc = activity.occupancyEvents.reduce((sum, oe) => sum + (oe.delta > 0 ? oe.delta : 0), 0);
  if (totalOcc > CORPUS_VENUE.legalCapacity * CORPUS_VENUE.occupancyWarnRatio) {
    attentionItems.push({
      id: "att-occupancy", type: "occupancy-warning", severity: "medium",
      title: `Occupancy at ${Math.round(totalOcc / CORPUS_VENUE.legalCapacity * 100)}%`,
      detail: `${totalOcc}/${CORPUS_VENUE.legalCapacity} — approaching legal capacity`,
      createdAt: minsAgo(randInt(2, 10)),
    });
  }

  // Minimum spend warning for VIP tables
  const vipSessions = openSessions.filter((s) =>
    s.minimumSpendCents && s.minimumSpendCents > 0
  );
  for (const vs of vipSessions.slice(0, 2)) {
    const sessionOrders = activity.orders.filter((o) => o.sessionId === vs.id);
    const spent = sessionOrders.reduce((sum, o) => sum + Math.round(o.total * 100), 0);
    if (spent < (vs.minimumSpendCents ?? 0) * CORPUS_VENUE.minimumSpendWarningRatio) {
      attentionItems.push({
        id: `att-minspend-${vs.id}`, type: "minimum-spend", severity: "low",
        title: `Low spend at ${vs.tableCode}`,
        detail: `${vs.displayName}: $${(spent / 100).toFixed(2)} spent of $${((vs.minimumSpendCents ?? 0) / 100).toFixed(2)} minimum`,
        createdAt: minsAgo(randInt(5, 30)),
        tableId: vs.tableId,
        sessionId: vs.id,
      });
    }
  }

  return { openSessions, inFlightOrders, unackedHelp, activeWaitlist, attentionItems, tonightActivity };
}

// ── Full corpus generator (90-day history + present tense) ───────────────

export interface FullCorpus {
  venue: typeof CORPUS_VENUE;
  zones: typeof CORPUS_ZONES;
  tables: CorpusTable[];
  roster: CorpusStaffMember[];
  menuItems: CorpusMenuItem[];
  menuCategories: typeof CORPUS_MENU_CATEGORIES;
  packages: CorpusPackage[];
  modifierGroups: Record<string, CorpusModifierGroup>;
  happyHourRules: CorpusHappyHourRule[];
  guestProfiles: GeneratedGuestProfile[];
  nightlyHistory: NightActivity[];
  events: GeneratedEvent[];
  reservations: GeneratedReservation[];
  promotions: GeneratedPromotion[];
  presentTense: PresentTenseState;
}

/**
 * Generate the full corpus — everything both demo mock-data and live seed
 * scripts need. Call this once, then slice into the appropriate output format.
 *
 * Re-seeds the PRNG internally for deterministic output.
 */
export function generateFullCorpus(seed = 42): FullCorpus {
  reseedRng(seed);

  const guestProfiles = generateGuestProfiles(30);
  const events = generateHistoricalEvents();
  reseedRng(seed + 1);
  const reservations = generateHistoricalReservations();
  reseedRng(seed + 2);
  const promotions = generateHistoricalPromotions();

  // Generate night activity for the past 90 open nights
  const nightlyHistory: NightActivity[] = [];
  for (let d = 90; d >= 0; d--) {
    const nightDate = daysAgo(d);
    if (!isOpenNight(nightDate)) continue;
    reseedRng(seed + 1000 + d * 7); // stable per-night seed
    nightlyHistory.push(generateNightActivity(nightDate));
  }

  reseedRng(seed + 9999);
  const presentTense = generatePresentTense();

  return {
    venue: CORPUS_VENUE,
    zones: CORPUS_ZONES,
    tables: CORPUS_TABLES,
    roster: CORPUS_ROSTER,
    menuItems: CORPUS_MENU_ITEMS,
    menuCategories: CORPUS_MENU_CATEGORIES,
    packages: CORPUS_PACKAGES,
    modifierGroups: CORPUS_MODIFIER_GROUPS,
    happyHourRules: CORPUS_HAPPY_HOUR_RULES,
    guestProfiles,
    nightlyHistory,
    events,
    reservations,
    promotions,
    presentTense,
  };
}
