/**
 * Staging seed: 2 fictional tenants with 3 months (90 days) of business activity.
 *
 * Usage: NEXT_PUBLIC_APP_MODE=live npx tsx prisma/seed-staging.ts
 *
 * Each tenant gets a full venue config, staff, menu, guest profiles, bookings,
 * workforce records, supply chain data, incidents, and nightly rollups.
 */

import type { Prisma, StaffRole } from "@prisma/client";
import { EventStatus, ReservationStatus } from "@prisma/client";
import { betterAuth } from "better-auth";
import { organization, admin, bearer } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { toCents } from "../src/features/shared/money";
import { getDb, getRawPrisma } from "../src/features/shared/db";
import { ensureMapPositions } from "../src/server/venue-core";

const DEMO_PASSWORD = "demo1234";

// ── Deterministic seeded PRNG ──────────────────────────────────────
let _seed = 42;
function rand(): number {
  _seed = (_seed * 1103515245 + 12345) & 0x7fffffff;
  return _seed / 0x7fffffff;
}
function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

// ── Tenant definitions ─────────────────────────────────────────────

const TENANTS = [
  {
    slug: "nyx-toronto",
    tenantName: "NYX Toronto",
    orgName: "NYX Nightclub",
    orgSlug: "nyx-toronto",
    city: "Toronto",
    address: "350 King Street West",
    timezone: "America/Toronto",
    currency: "CAD" as const,
    logoInitials: "NX",
    nightStartHour: 20,
    nightEndHour: 8,
    openingHours: [
      { day: "Wednesday", open: "22:00", close: "03:00" },
      { day: "Thursday", open: "22:00", close: "03:00" },
      { day: "Friday", open: "22:00", close: "04:00" },
      { day: "Saturday", open: "22:00", close: "04:00" },
    ],
    serviceFees: [
      { id: "fee-service", name: "Service", type: "percentage" as string, value: 5 },
      { id: "fee-hst", name: "HST", type: "percentage" as string, value: 13 },
    ],
    zones: [
      { suffix: "vip", name: "Skybox VIP", description: "Elevated bottle-service booths", color: "violet" },
      { suffix: "main", name: "Main Room", description: "High-energy dance floor tables", color: "fuchsia" },
      { suffix: "patio", name: "Rooftop Patio", description: "Open-air lounge with city views", color: "cyan" },
    ],
    tablesPerZone: [5, 8, 4],
    staff: [
      { name: "Liam Chen", email: "liam@nyxtoronto.com", role: "manager" as StaffRole, initials: "LC", hourlyRate: 2800, employmentType: "salaried" },
      { name: "Priya Sharma", email: "priya@nyxtoronto.com", role: "bartender" as StaffRole, initials: "PS", hourlyRate: 2400, employmentType: "hourly" },
      { name: "Marcus Lee", email: "marcus@nyxtoronto.com", role: "runner" as StaffRole, initials: "ML", hourlyRate: 1900, employmentType: "hourly" },
      { name: "Sophie Tremblay", email: "sophie@nyxtoronto.com", role: "host" as StaffRole, initials: "ST", hourlyRate: 2100, employmentType: "hourly" },
      { name: "Devon Wright", email: "devon@nyxtoronto.com", role: "security" as StaffRole, initials: "DW", hourlyRate: 2200, employmentType: "hourly" },
      { name: "Jasmine Park", email: "jasmine@nyxtoronto.com", role: "promoter" as StaffRole, initials: "JP", hourlyRate: 0, employmentType: "commission" },
    ],
  },
  {
    slug: "maison-lyon",
    tenantName: "Maison Lyon",
    orgName: "Maison Lyon",
    orgSlug: "maison-lyon",
    city: "Lyon",
    address: "12 Quai Rambaud",
    timezone: "Europe/Paris",
    currency: "EUR" as const,
    logoInitials: "ML",
    nightStartHour: 20,
    nightEndHour: 8,
    openingHours: [
      { day: "Thursday", open: "23:00", close: "05:00" },
      { day: "Friday", open: "23:00", close: "06:00" },
      { day: "Saturday", open: "23:00", close: "06:00" },
    ],
    serviceFees: [
      { id: "fee-service", name: "Service", type: "percentage" as string, value: 8 },
      { id: "fee-tva", name: "TVA", type: "percentage" as string, value: 20 },
    ],
    zones: [
      { suffix: "prive", name: "Le Privé", description: "Salons privés avec service bouteille", color: "amber" },
      { suffix: "dance", name: "La Piste", description: "Tables autour de la piste de danse", color: "fuchsia" },
      { suffix: "jardin", name: "Le Jardin", description: "Terrasse couverte côté Saône", color: "emerald" },
    ],
    tablesPerZone: [4, 6, 5],
    staff: [
      { name: "Camille Dupont", email: "camille@maisonlyon.fr", role: "manager" as StaffRole, initials: "CD", hourlyRate: 2600, employmentType: "salaried" },
      { name: "Youssef Ben Ali", email: "youssef@maisonlyon.fr", role: "bartender" as StaffRole, initials: "YB", hourlyRate: 2200, employmentType: "hourly" },
      { name: "Léa Martin", email: "lea@maisonlyon.fr", role: "runner" as StaffRole, initials: "LM", hourlyRate: 1800, employmentType: "hourly" },
      { name: "Hugo Bernard", email: "hugo@maisonlyon.fr", role: "host" as StaffRole, initials: "HB", hourlyRate: 2000, employmentType: "hourly" },
      { name: "Romain Dubois", email: "romain@maisonlyon.fr", role: "promoter" as StaffRole, initials: "RD", hourlyRate: 0, employmentType: "commission" },
    ],
  },
] as const;

// ── Menu catalog ────────────────────────────────────────────────────

const CATEGORIES = [
  { suffix: "champagne", name: "Champagne", sortOrder: 0 },
  { suffix: "tequila", name: "Tequila", sortOrder: 1 },
  { suffix: "vodka", name: "Vodka", sortOrder: 2 },
  { suffix: "cognac", name: "Cognac", sortOrder: 3 },
  { suffix: "whisky", name: "Whisky", sortOrder: 4 },
  { suffix: "gin", name: "Gin", sortOrder: 5 },
];

const MENU_ITEMS = [
  { suffix: "moet", cat: "champagne", name: "Moët Impérial", price: 160, inv: 20, isAlcoholic: true, abv: 12 },
  { suffix: "dom", cat: "champagne", name: "Dom Pérignon", price: 320, inv: 8, isAlcoholic: true, abv: 12.5 },
  { suffix: "ace", cat: "champagne", name: "Armand de Brignac", price: 500, inv: 6, isAlcoholic: true, abv: 12.5 },
  { suffix: "patron", cat: "tequila", name: "Patrón Silver", price: 220, inv: 15, isAlcoholic: true, abv: 40 },
  { suffix: "don-julio", cat: "tequila", name: "Don Julio 1942", price: 340, inv: 10, isAlcoholic: true, abv: 40 },
  { suffix: "clase-azul", cat: "tequila", name: "Clase Azul Reposado", price: 400, inv: 5, isAlcoholic: true, abv: 40 },
  { suffix: "titos", cat: "vodka", name: "Tito's Handmade", price: 180, inv: 25, isAlcoholic: true, abv: 40 },
  { suffix: "greygoose", cat: "vodka", name: "Grey Goose", price: 220, inv: 18, isAlcoholic: true, abv: 40 },
  { suffix: "belvedere", cat: "vodka", name: "Belvedere", price: 300, inv: 10, isAlcoholic: true, abv: 40 },
  { suffix: "hennessy", cat: "cognac", name: "Hennessy VS", price: 260, inv: 12, isAlcoholic: true, abv: 40 },
  { suffix: "remy", cat: "cognac", name: "Rémy Martin XO", price: 440, inv: 4, isAlcoholic: true, abv: 40 },
  { suffix: "macallan", cat: "whisky", name: "Macallan 12", price: 320, inv: 8, isAlcoholic: true, abv: 43 },
  { suffix: "jw-blue", cat: "whisky", name: "Johnnie Walker Blue", price: 430, inv: 6, isAlcoholic: true, abv: 40 },
  { suffix: "hendricks", cat: "gin", name: "Hendrick's", price: 210, inv: 14, isAlcoholic: true, abv: 41.4 },
  { suffix: "monkey", cat: "gin", name: "Monkey 47", price: 250, inv: 10, isAlcoholic: true, abv: 47 },
];

const GUEST_FIRST_NAMES = ["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Quinn", "Avery", "Blake", "Charlie", "Dana", "Emery", "Finley", "Harper", "Jamie", "Kai", "Logan", "Noel", "Reese", "Sage"];
const GUEST_LAST_NAMES = ["Smith", "Patel", "Kim", "Nguyen", "Dubois", "Moreau", "Peterson", "Okafor", "Santos", "Yamamoto"];
const HELP_TYPES = ["call-waiter", "refill-ice", "clean-table", "security", "bill"] as const;
const SETTLEMENT_METHODS = ["terminal", "cash", "house"] as const;

function seededPin(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  return String(Math.abs(hash) % 1000000).padStart(6, "0");
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  const prisma = getRawPrisma();

  const seedAuth = betterAuth({
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    secret: process.env.AUTH_SECRET ?? "seed-secret-at-least-32-characters-long",
    emailAndPassword: { enabled: true },
    user: { additionalFields: { isPlatformAdmin: { type: "boolean" as const, defaultValue: false, input: false } } },
    plugins: [organization(), admin(), bearer()],
  });

  async function seedUser(name: string, email: string) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return seedAuth.api.signInEmail({ body: { email, password: DEMO_PASSWORD } });
    return seedAuth.api.signUpEmail({ body: { name, email, password: DEMO_PASSWORD } });
  }

  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() - 1);

  function nightDate(d: Date): string { return d.toISOString().slice(0, 10); }

  function isOpenNight(d: Date, openingHours: readonly { day: string }[]): boolean {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return openingHours.some((h) => h.day === days[d.getDay()]);
  }

  for (const tenantDef of TENANTS) {
    console.log(`\n── Seeding ${tenantDef.tenantName} (3 months) ──────────────────`);
    const slug = tenantDef.slug;
    const venueId = `${slug}-venue`;

    // ── Tenant ──
    const tenant = await prisma.tenant.upsert({
      where: { slug }, update: {},
      create: { name: tenantDef.tenantName, slug, plan: "pro", status: "active" },
    });

    // ── Users + org ──
    const staffUsers: { userId: string; name: string; role: StaffRole; token: string; initials: string; hourlyRate: number; employmentType: string }[] = [];
    let managerToken = "";
    for (const s of tenantDef.staff) {
      const result = await seedUser(s.name, s.email);
      staffUsers.push({ userId: result.user.id, name: s.name, role: s.role, token: result.token!, initials: s.initials, hourlyRate: s.hourlyRate, employmentType: s.employmentType });
      if (s.role === "manager") managerToken = result.token!;
    }

    const existingOrg = await prisma.organization.findUnique({ where: { slug: tenantDef.orgSlug } });
    const org = existingOrg ?? await seedAuth.api.createOrganization({
      headers: new Headers({ authorization: `Bearer ${managerToken}` }),
      body: { name: tenantDef.orgName, slug: tenantDef.orgSlug },
    });

    for (const s of staffUsers) {
      if (s.token === managerToken) continue;
      if (!(await prisma.member.findFirst({ where: { userId: s.userId, organizationId: org.id } }))) {
        await seedAuth.api.addMember({
          headers: new Headers({ authorization: `Bearer ${managerToken}` }),
          body: { userId: s.userId, organizationId: org.id, role: "member" },
        });
      }
    }

    // ── Staff profiles ──
    for (const s of staffUsers) {
      await prisma.staffProfile.upsert({
        where: { userId: s.userId }, update: { role: s.role },
        create: { userId: s.userId, role: s.role, phone: "+1 555 000 0000", avatarInitials: s.initials, assignedZoneIds: [], isOnShift: true, hourlyRateCents: s.hourlyRate, tipPoolWeight: 1.0, employmentType: s.employmentType },
      });
    }
    const staffIds = staffUsers.map((s) => s.userId);
    const staffById = new Map(staffUsers.map((s) => [s.userId, s]));

    // ── Venue config ──
    await prisma.venue.upsert({
      where: { id: org.id }, update: {},
      create: {
        id: org.id, address: tenantDef.address, city: tenantDef.city, timezone: tenantDef.timezone, currency: tenantDef.currency,
        openingHours: tenantDef.openingHours as unknown as Prisma.InputJsonValue,
        serviceFees: tenantDef.serviceFees as unknown as Prisma.InputJsonValue,
        floorMap: { width: 16, height: 9 } as unknown as Prisma.InputJsonValue,
        autoApproveGuests: false, logoInitials: tenantDef.logoInitials,
        slaThresholds: { orderWarnMinutes: 6, orderCriticalMinutes: 12, helpWarnMinutes: 4, helpCriticalMinutes: 8 } as unknown as Prisma.InputJsonValue,
        lastCallAutoFlagTables: true, tipPresets: [15, 20] as unknown as Prisma.InputJsonValue, defaultTipPct: 15,
        nightStartHour: tenantDef.nightStartHour, nightEndHour: tenantDef.nightEndHour, publicSlug: slug,
        compThresholdCents: 10000, minimumSpendWarningRatio: 0.25, legalCapacity: 400, occupancyWarnRatio: 0.9, coatCheckEnabled: true, doorRequiresIdCheck: true,
      },
    });

    // ── Zones + tables ──
    const zoneIds: string[] = []; const zoneNames: string[] = [];
    interface TableRef { id: string; code: string; zoneId: string; zoneName: string }
    const allTables: TableRef[] = [];
    for (let zi = 0; zi < tenantDef.zones.length; zi++) {
      const z = tenantDef.zones[zi]; const zid = `${slug}-zone-${z.suffix}`;
      await prisma.zone.upsert({ where: { id: zid }, update: {}, create: { id: zid, venueId: org.id, name: z.name, description: z.description, color: z.color } });
      zoneIds.push(zid); zoneNames.push(z.name);
      const tc = tenantDef.tablesPerZone[zi];
      for (let ti = 1; ti <= tc; ti++) {
        const prefix = z.suffix.toUpperCase().slice(0, 3); const code = `${prefix}-${String(ti).padStart(2, "0")}`;
        const tid = `${slug}-t-${z.suffix}-${ti}`;
        await prisma.venueTable.upsert({ where: { id: tid }, update: {}, create: { id: tid, venueId: org.id, zoneId: zid, code, label: `${z.name} ${ti}`, seats: z.suffix.includes("vip") || z.suffix.includes("priv") ? 8 : 4, status: "open", qrSlug: `${slug}-${z.suffix}-${ti}` } });
        allTables.push({ id: tid, code, zoneId: zid, zoneName: z.name });
      }
    }

    // ── Menu ──
    const catIds: Record<string, string> = {}; const catNameById: Record<string, string> = {};
    for (const cat of CATEGORIES) {
      const cid = `${slug}-cat-${cat.suffix}`; catIds[cat.suffix] = cid; catNameById[cid] = cat.name;
      await prisma.menuCategory.upsert({ where: { id: cid }, update: {}, create: { id: cid, venueId: org.id, name: cat.name, description: "", sortOrder: cat.sortOrder, isActive: true, modifierGroups: [] } });
    }
    interface ItemRef { id: string; name: string; priceCents: number; catId: string; isAlcoholic: boolean; abv?: number }
    const allItems: ItemRef[] = [];
    for (const item of MENU_ITEMS) {
      const iid = `${slug}-mi-${item.suffix}`; const cid = catIds[item.cat]; const pc = toCents(item.price);
      await prisma.menuItem.upsert({ where: { id: iid }, update: {}, create: { id: iid, venueId: org.id, categoryId: cid, name: item.name, description: "", priceCents: pc, icon: "wine", tags: [], isAvailable: true, inventory: item.inv, isAlcoholic: item.isAlcoholic, abv: item.abv ?? null, allergens: [] } });
      allItems.push({ id: iid, name: item.name, priceCents: pc, catId: cid, isAlcoholic: item.isAlcoholic, abv: item.abv });
      await prisma.stockMovement.upsert({ where: { id: `${iid}-init` }, update: {}, create: { id: `${iid}-init`, venueId: org.id, menuItemId: iid, itemName: item.name, type: "restock", delta: item.inv, note: "Initial inventory", unitCostCents: Math.round(pc * 0.35) } });
    }

    await ensureMapPositions(getDb({ venueId: org.id }));

    // ── Happy hour rules ──
    for (const rule of [
      { id: `${slug}-hh-early`, name: "Early Bird", daysOfWeek: [4, 5, 6], startTime: "22:00", endTime: "23:30", discountPct: 15, appliesToCategoryIds: [catIds["vodka"], catIds["gin"]] },
      { id: `${slug}-hh-champagne`, name: "Champagne Night", daysOfWeek: [4], startTime: "22:00", endTime: "00:00", discountPct: 20, appliesToCategoryIds: [catIds["champagne"]] },
    ]) {
      await prisma.happyHourRule.upsert({ where: { id: rule.id }, update: {}, create: { ...rule, venueId: org.id, isActive: true } });
    }

    // ── Events (6 per tenant, spanning 3 months) ──
    const eventDefs = [
      { suffix: "latin", name: "Latin Fiesta", capacity: 200 },
      { suffix: "techno", name: "Techno Warehouse", capacity: 300 },
      { suffix: "rnb", name: "R&B Saturdays", capacity: 250 },
      { suffix: "disco", name: "Disco Fever", capacity: 180 },
      { suffix: "hiphop", name: "Hip Hop Takeover", capacity: 220 },
      { suffix: "house", name: "House Sessions", capacity: 150 },
    ];
    for (let ei = 0; ei < eventDefs.length; ei++) {
      const ev = eventDefs[ei]; const eid = `${slug}-event-${ev.suffix}`;
      const isPast = ei < 4;
      const daysOffset = isPast ? randInt(30, 85) : -(randInt(3, 14));
      const startsAt = new Date(endDate); startsAt.setDate(startsAt.getDate() - daysOffset); startsAt.setHours(22, 0, 0, 0);
      const endsAt = new Date(startsAt); endsAt.setHours(endsAt.getHours() + 5);
      const status = ei < 3 ? EventStatus.ended : ei === 3 ? EventStatus.published : EventStatus.draft;
      await prisma.venueEvent.upsert({ where: { id: eid }, update: {}, create: { id: eid, venueId: org.id, name: ev.name, description: `${ev.name} at ${tenantDef.orgName}`, startsAt, endsAt, zoneId: pick(zoneIds), capacity: ev.capacity, status, guestlistEnabled: status !== EventStatus.draft } });

      if (status !== EventStatus.draft) {
        const gc = Math.floor(ev.capacity * (0.3 + rand() * 0.5));
        for (let gi = 0; gi < gc; gi++) {
          const gStatus = status === "ended" ? pick(["confirmed", "confirmed", "checked_in", "checked_in", "no_show"]) : pick(["invited", "invited", "confirmed", "confirmed"]);
          await prisma.eventGuest.upsert({ where: { id: `${eid}-g-${gi}` }, update: {}, create: { id: `${eid}-g-${gi}`, eventId: eid, name: `${pick(GUEST_FIRST_NAMES)} ${pick(GUEST_LAST_NAMES)}`, partySize: randInt(1, 4), status: gStatus } });
        }
      }

      // Event costs for past events
      if (isPast) {
        await prisma.eventCost.upsert({ where: { id: `${eid}-cost-1` }, update: {}, create: { id: `${eid}-cost-1`, venueId: org.id, eventId: eid, label: "DJ/Artist fee", kind: "talent", amountCents: randInt(80000, 300000) } });
        await prisma.eventCost.upsert({ where: { id: `${eid}-cost-2` }, update: {}, create: { id: `${eid}-cost-2`, venueId: org.id, eventId: eid, label: "Paid social ads", kind: "marketing", amountCents: randInt(15000, 60000) } });
      }
    }

    // ── Promotions ──
    const promoDefs = [
      { code: "WELCOME20", name: "Welcome 20%", type: "percentage", value: 20 },
      { code: "FRIENDS10", name: "Friends & Family", type: "percentage", value: 10 },
      { code: "VIP50OFF", name: "VIP $50 Off", type: "flat", value: 50 },
    ];
    for (const promo of promoDefs) {
      const pid = `${slug}-promo-${promo.code.toLowerCase()}`;
      const sAt = new Date(endDate); sAt.setDate(sAt.getDate() - randInt(60, 90));
      const eAt = new Date(sAt); eAt.setDate(eAt.getDate() + randInt(30, 60));
      if (eAt > endDate) eAt.setDate(endDate.getDate() + randInt(7, 14));
      await prisma.promotion.upsert({ where: { venueId_code: { venueId: org.id, code: promo.code } }, update: {}, create: { id: pid, venueId: org.id, code: promo.code, name: promo.name, type: promo.type, value: promo.value, appliesToCategoryIds: [], startsAt: sAt, endsAt: eAt, redemptionCount: randInt(10, 50) } });
    }

    // ── Guest profiles (15 per tenant) ──
    const guestProfiles: { id: string; displayName: string; firstName: string; vipTier: string; tags: string[]; visitCount: number; lifetimeNetCents: number }[] = [];
    for (let gi = 0; gi < 15; gi++) {
      const fn = GUEST_FIRST_NAMES[gi % GUEST_FIRST_NAMES.length]; const ln = GUEST_LAST_NAMES[gi % GUEST_LAST_NAMES.length];
      const gid = `${slug}-gp-${gi}`; const visits = randInt(0, 20); const lifetime = visits * randInt(8000, 120000);
      const vipTier = lifetime > 500000 ? "vip" : lifetime > 100000 ? "regular" : visits > 5 ? "regular" : "none";
      const tags: string[] = [];
      if (vipTier === "vip") tags.push("high-spender");
      if (visits > 10) tags.push("regular");
      if (rand() < 0.15) tags.push("industry");
      const status = gi === 14 ? "banned" : "active";
      let lastVisit: Date | undefined = undefined;
      if (visits > 0) {
        lastVisit = new Date(endDate);
        lastVisit.setDate(lastVisit.getDate() - randInt(0, 30));
      }
      await prisma.guestProfile.upsert({ where: { id: gid }, update: {}, create: { id: gid, venueId: org.id, displayName: `${fn} ${ln}`, firstName: fn, lastName: ln, phone: visits > 1 ? `+1 555 ${String(gi).padStart(4, "0")}` : null, email: gi < 8 ? `${fn.toLowerCase()}.${ln.toLowerCase()}@example.com` : null, tags, vipTier, status, banReason: status === "banned" ? "Multiple altercations — banned indefinitely" : null, bannedByStaffId: status === "banned" ? pick(staffIds) : null, marketingConsent: { email: rand() < 0.5, sms: rand() < 0.3, capturedAt: new Date(endDate.getTime() - randInt(1, 300) * 86400000).toISOString(), source: pick(["door", "reservation", "door"]) }, lastVisitAt: lastVisit, visitCount: visits, lifetimeNetCents: lifetime } });
      guestProfiles.push({ id: gid, displayName: `${fn} ${ln}`, firstName: fn, vipTier, tags, visitCount: visits, lifetimeNetCents: lifetime });
    }

    // ── Suppliers ──
    const suppliers = [
      { suffix: "distrib", name: `${tenantDef.orgName}-approved Distributor`, leadTimeDays: 2, orderDays: [1, 2, 3, 4, 5] },
      { suffix: "direct", name: "Direct Import Co.", leadTimeDays: 4, orderDays: [1, 3, 5] },
    ];
    for (const sup of suppliers) {
      const sid = `${slug}-sup-${sup.suffix}`;
      await prisma.supplier.upsert({ where: { id: sid }, update: {}, create: { id: sid, venueId: org.id, name: sup.name, contactName: "Sales Manager", email: `orders@${sup.name.toLowerCase().replace(/[^a-z]/g, "")}.com`, leadTimeDays: sup.leadTimeDays, orderDays: sup.orderDays, minimumOrderCents: sup.suffix === "distrib" ? 50000 : 100000, active: true } });
      // Supplier items: top 8 menu items
      for (let i = 0; i < Math.min(8, allItems.length); i++) {
        const mi = allItems[i];
        await prisma.supplierItem.upsert({ where: { id: `${sid}-si-${i}` }, update: {}, create: { id: `${sid}-si-${i}`, supplierId: sid, menuItemId: mi.id, unitCostCents: Math.round(mi.priceCents * (0.3 + rand() * 0.15)), caseSize: randInt(6, 24), preferred: i < 4 && sup.suffix === "distrib" } });
      }
      // 2 POs: one received (older), one submitted (recent)
      const po1Id = `${sid}-po-1`;
      const subAt1 = new Date(endDate); subAt1.setDate(subAt1.getDate() - randInt(45, 80));
      await prisma.purchaseOrder.upsert({ where: { id: po1Id }, update: {}, create: { id: po1Id, venueId: org.id, supplierId: sid, code: `PO-${slug}-${sup.suffix.slice(0, 4).toUpperCase()}-JUL`, status: "received", submittedAt: subAt1, submittedByStaffId: pick(staffIds.filter((_, i) => i < 2)), expectedAt: new Date(subAt1.getTime() + sup.leadTimeDays * 86400000), lines: allItems.slice(0, 3).map((mi, li) => ({ menuItemId: mi.id, itemName: mi.name, qtyOrdered: randInt(6, 24), qtyReceived: randInt(6, 24), unitCostCents: Math.round(mi.priceCents * 0.33), lineTotalCents: 0 })).map((l) => ({ ...l, lineTotalCents: l.qtyReceived * l.unitCostCents })), subtotalCents: 0 } });
      const po2Id = `${sid}-po-2`;
      const subAt2 = new Date(endDate); subAt2.setDate(subAt2.getDate() - randInt(2, 14));
      await prisma.purchaseOrder.upsert({ where: { id: po2Id }, update: {}, create: { id: po2Id, venueId: org.id, supplierId: sid, code: `PO-${slug}-${sup.suffix.slice(0, 4).toUpperCase()}-AUG`, status: "submitted", submittedAt: subAt2, submittedByStaffId: pick(staffIds.filter((_, i) => i < 3)), expectedAt: new Date(subAt2.getTime() + sup.leadTimeDays * 86400000), lines: allItems.slice(3, 6).map((mi) => ({ menuItemId: mi.id, itemName: mi.name, qtyOrdered: randInt(6, 18), qtyReceived: 0, unitCostCents: Math.round(mi.priceCents * 0.33), lineTotalCents: 0 })).map((l) => ({ ...l, lineTotalCents: l.qtyOrdered * l.unitCostCents })), subtotalCents: 0 } });
      // Fix subtotal for PO2
      const po2Lines = await prisma.purchaseOrder.findUnique({ where: { id: po2Id } });
      if (po2Lines) {
        const lines = po2Lines.lines as any[];
        const subtotal = lines.reduce((s: number, l: any) => s + l.lineTotalCents, 0);
        await prisma.purchaseOrder.update({ where: { id: po2Id }, data: { subtotalCents: subtotal } });
      }
    }

    // ── Stocktakes (3 per tenant) ──
    for (let si = 0; si < 3; si++) {
      const stId = `${slug}-stocktake-${si}`; const sDate = new Date(endDate); sDate.setDate(sDate.getDate() - randInt(14, 70));
      const lines = allItems.slice(0, 6).map((mi) => ({ menuItemId: mi.id, itemName: mi.name, expectedQty: randInt(3, 20), countedQty: randInt(3, 20), varianceCents: 0 }));
      const totalVariance = lines.reduce((s, l) => s + (l.countedQty! - l.expectedQty) * 3500, 0);
      for (const l of lines) l.varianceCents = (l.countedQty! - l.expectedQty) * 3500;
      await prisma.stocktake.upsert({ where: { id: stId }, update: {}, create: { id: stId, venueId: org.id, businessDate: nightDate(sDate), scope: si === 0 ? "full" : pick(["zone", "category"]), status: si < 2 ? "committed" : "open", startedAt: new Date(sDate.getTime() + 4 * 3600000), committedAt: si < 2 ? new Date(sDate.getTime() + 5 * 3600000) : null, startedByStaffId: pick(staffIds.filter((_, i) => i < 4)), lines, totalVarianceCents: totalVariance } });
    }

    // ── Profit targets ──
    for (const pt of [{ metric: "pour-cost", targetValue: 0.22, warnAt: 0.28, direction: "above" }, { metric: "gross-margin", targetValue: 0.65, warnAt: 0.60, direction: "below" }]) {
      const ptId = `${slug}-pt-${pt.metric}`;
      await prisma.profitTarget.upsert({ where: { id: ptId }, update: {}, create: { id: ptId, venueId: org.id, metric: pt.metric, scope: "venue", targetValue: pt.targetValue, warnAt: pt.warnAt, direction: pt.direction } });
    }

    // ── Shift templates (6 per staff, recurring patterns) ──
    const roleDays: Record<string, number[]> = { manager: [4, 5, 6], bartender: [4, 5, 6], runner: [4, 5, 6], host: [4, 5], security: [5, 6], promoter: [5, 6] };
    for (const s of staffUsers) {
      const days = roleDays[s.role] ?? [5, 6];
      for (const dow of days) {
        const stId = `${slug}-sht-${s.userId.slice(0, 8)}-${dow}`;
        await prisma.shiftTemplate.upsert({ where: { id: stId }, update: {}, create: { id: stId, venueId: org.id, staffId: s.userId, dayOfWeek: dow, startTime: s.role === "manager" ? "21:00" : "22:00", endTime: dow === 6 ? "06:00" : "04:00", zoneId: s.role === "bartender" ? zoneIds[0] : null, role: s.role, active: true } });
      }
    }

    // ── Tip pool rule ──
    const tipRuleId = `${slug}-tip-rule`;
    await prisma.tipPoolRule.upsert({ where: { id: tipRuleId }, update: {}, create: { id: tipRuleId, venueId: org.id, name: "Hours-weighted pool", basis: "hours-weighted", includeRoles: ["bartender", "runner", "host", "security"], houseRetentionPct: 0, active: true } });

    // ── Commission rules (for promoters) ──
    for (const s of staffUsers.filter((s) => s.role === "promoter")) {
      const crId = `${slug}-cr-${s.userId.slice(0, 8)}`;
      await prisma.commissionRule.upsert({ where: { id: crId }, update: {}, create: { id: crId, venueId: org.id, staffId: s.userId, basis: "net-revenue", ratePct: 10, qualifier: { minPartySize: 4 } } });
    }

    // ── 3 months of business activity ───────────────────────────────
    const fees = tenantDef.serviceFees;
    let orderSeq = 0; let totalOrders = 0; let totalSessions = 0; let totalReservations = 0; let totalHelpRequests = 0;

    const d = new Date(endDate);
    d.setDate(d.getDate() - 95);
    // Track tip pool per night
    const nightlyTips: Record<string, { poolCents: number; staffMinutes: Record<string, number> }> = {};

    while (d <= endDate) {
      if (!isOpenNight(d, tenantDef.openingHours)) { d.setDate(d.getDate() + 1); continue; }
      const nightStr = nightDate(d);
      const dow = d.getDay();
      const isWeekend = dow === 5 || dow === 6;
      const sessionsTonight = isWeekend ? randInt(8, 16) : randInt(4, 10);

      if (!nightlyTips[nightStr]) nightlyTips[nightStr] = { poolCents: 0, staffMinutes: {} };

      // ── Occupancy events (door open + walk-ins) ──
      const occDelta = sessionsTonight * randInt(2, 4);
      await prisma.occupancyEvent.upsert({ where: { id: `${slug}-oe-${nightStr}-0` }, update: {}, create: { id: `${slug}-oe-${nightStr}-0`, venueId: org.id, businessDate: nightStr, delta: occDelta, reason: "door open & walk-ins", staffId: pick(staffIds), at: new Date(d.getTime() + 22 * 3600000) } });

      // ── Admissions (2-6 per night) ──
      const admCount = randInt(2, 6);
      for (let ai = 0; ai < admCount; ai++) {
        const admId = `${slug}-adm-${nightStr}-${ai}`;
        const gp = rand() < 0.3 ? pick(guestProfiles) : null;
        await prisma.admission.upsert({ where: { id: admId }, update: {}, create: { id: admId, venueId: org.id, businessDate: nightStr, guestProfileId: gp?.id, partySize: randInt(1, 6), admissionType: pick(["cover", "cover", "guestlist", "comp"]), amountOwedCents: rand() < 0.3 ? 0 : randInt(2000, 6000), source: pick(["walk-in", "walk-in", "guestlist"]), idCheck: rand() < 0.5 ? { checked: true, dobVerified: true, byStaffId: pick(staffIds), at: new Date(d.getTime() + (22 + randInt(0, 3)) * 3600000).toISOString() } : undefined, admittedByStaffId: pick(staffIds.filter((_, i) => i < 4)), admittedByStaffName: staffById.get(pick(staffIds.filter((_, i) => i < 4)))?.name ?? "Staff", admittedAt: new Date(d.getTime() + (22 + randInt(0, 3)) * 3600000) } });
        if (gp) {
          await prisma.guestLink.upsert({ where: { id: `${slug}-gl-${nightStr}-${ai}` }, update: {}, create: { id: `${slug}-gl-${nightStr}-${ai}`, venueId: org.id, guestProfileId: gp.id, admissionId: admId } });
        }
      }

      // ── Waitlist entries (1-3 per night) ──
      for (let wi = 0; wi < randInt(1, 3); wi++) {
        const wlId = `${slug}-wl-${nightStr}-${wi}`; const wlTime = new Date(d); wlTime.setHours(22 + randInt(0, 3), randInt(0, 59));
        const status = isWeekend ? pick(["waiting", "waiting", "notified", "seated"]) : pick(["notified", "seated", "waiting"]);
        await prisma.waitlistEntry.upsert({ where: { id: wlId }, update: {}, create: { id: wlId, venueId: org.id, name: `${pick(GUEST_FIRST_NAMES)} ${pick(GUEST_LAST_NAMES)}`, partySize: randInt(1, 6), phone: rand() < 0.4 ? `+1 555 ${String(orderSeq).padStart(4, "0")}` : null, quotedMinutes: randInt(15, 45), status, joinedAt: wlTime, notifiedAt: status !== "waiting" ? new Date(wlTime.getTime() + randInt(15, 60) * 60000) : null } });
      }

      // ── Shifts for tonight ──
      const nightStaff: string[] = [];
      const staffTimes: Record<string, { start: Date; end: Date }> = {};
      for (const s of staffUsers) {
        const rd = roleDays[s.role] ?? [5, 6];
        if (!rd.includes(dow)) continue;
        const shiftId = `${slug}-shift-${nightStr}-${s.userId.slice(0, 8)}`;
        const startHr = s.role === "manager" ? 21 : 22; const endHr = dow === 6 ? 6 : 4;
        const sStart = new Date(d); sStart.setHours(startHr, 0, 0, 0);
        const sEnd = new Date(d); sEnd.setDate(sEnd.getDate() + (endHr < startHr ? 1 : 0)); sEnd.setHours(endHr, randInt(0, 15), 0, 0);
        await prisma.shift.upsert({ where: { id: shiftId }, update: {}, create: { id: shiftId, venueId: org.id, staffId: s.userId, businessDate: nightStr, scheduledStart: `${String(startHr).padStart(2, "0")}:00`, scheduledEnd: `${String(endHr).padStart(2, "0")}:00`, zoneId: s.role === "bartender" ? zoneIds[0] : null, role: s.role, status: "completed" } });

        // Time entry (clock-in/out with slight variance)
        const teId = `${slug}-te-${nightStr}-${s.userId.slice(0, 8)}`;
        const clockIn = new Date(sStart); clockIn.setMinutes(clockIn.getMinutes() + randInt(-10, 15));
        const clockOut = new Date(sEnd); clockOut.setMinutes(clockOut.getMinutes() + randInt(-10, 10));
        const minutesWorked = Math.round((clockOut.getTime() - clockIn.getTime()) / 60000) - randInt(0, 30);
        await prisma.timeEntry.upsert({ where: { id: teId }, update: {}, create: { id: teId, venueId: org.id, shiftId: shiftId, staffId: s.userId, clockInAt: clockIn, clockOutAt: clockOut, breaks: rand() < 0.4 ? [{ startedAt: new Date(clockIn.getTime() + randInt(60, 180) * 60000).toISOString(), endedAt: new Date(clockIn.getTime() + randInt(90, 210) * 60000).toISOString(), paid: false }] : [], source: "self", minutesWorked: Math.max(0, minutesWorked) } });
        nightStaff.push(s.userId);
        staffTimes[s.userId] = { start: clockIn, end: clockOut };
        nightlyTips[nightStr].staffMinutes[s.userId] = Math.max(0, minutesWorked);
      }

      // ── Sessions + orders ──
      let nightRevenue = 0; let nightOrderCount = 0;
      const zoneRevenue: Record<string, { revenueCents: number; orderCount: number }> = {};
      const itemSales: Record<string, { name: string; count: number; revenueCents: number }> = {};
      const staffDeliveries: Record<string, { name: string; role: string; ordersDelivered: number; totalMinutes: number; revenueServedCents: number }> = {};
      const categorySales: Record<string, { categoryName: string; unitsSold: number }> = {};

      for (let si = 0; si < sessionsTonight; si++) {
        const table = pick(allTables); const fn = pick(GUEST_FIRST_NAMES); const partySize = randInt(2, 6);
        const arriveHr = 22 + randInt(0, 3);
        const sStart = new Date(d); sStart.setHours(arriveHr, randInt(0, 59), 0, 0);
        const sEnd = new Date(sStart); sEnd.setHours(sEnd.getHours() + randInt(1, 3));
        const seId = `${slug}-gs-${nightStr}-${si}`;
        const sessionStatus = isWeekend ? pick(["closed", "closed", "closed", "approved"]) : pick(["closed", "closed"]);

        // Link guest profile for some sessions
        const gp = rand() < 0.3 ? pick(guestProfiles) : null;
        const promoter = staffUsers.find((s) => s.role === "promoter" && rand() < 0.6);

        await prisma.guestSession.upsert({ where: { id: seId }, update: {}, create: { id: seId, venueId: org.id, tableId: table.id, tableCode: table.code, zoneName: table.zoneName, displayName: fn, partySize, status: sessionStatus as any, settlementMethod: sessionStatus === "closed" ? pick([...SETTLEMENT_METHODS]) : null, settledExternallyAt: sessionStatus === "closed" ? sEnd : null, minimumSpendCents: table.code.includes("VIP") || table.code.includes("PRIV") ? randInt(50000, 200000) : null, promoterId: promoter?.userId, guestProfileId: gp?.id, createdAt: sStart } });
        totalSessions++;
        if (gp) await prisma.guestLink.upsert({ where: { id: `${seId}-gl` }, update: {}, create: { id: `${seId}-gl`, venueId: org.id, guestProfileId: gp.id, sessionId: seId } });

        for (let oi = 0; oi < randInt(1, 3); oi++) {
          orderSeq++; const oid = `${slug}-ord-${nightStr}-${orderSeq}`;
          const oCode = `${String.fromCharCode(65 + (orderSeq % 26))}-${String(orderSeq).padStart(3, "0")}`;
          const oTime = new Date(sStart); oTime.setMinutes(oTime.getMinutes() + oi * randInt(15, 40));
          const itemCount = randInt(1, 3);
          const oItems: { item: ItemRef; qty: number }[] = []; let subtotalCents = 0;
          for (let ii = 0; ii < itemCount; ii++) { const it = pick(allItems); oItems.push({ item: it, qty: 1 }); subtotalCents += it.priceCents; }
          let totalFeeCents = 0;
          for (const fee of fees) { const a = fee.type === "flat" ? toCents(fee.value) : Math.round(subtotalCents * fee.value / 100); totalFeeCents += a; }
          const tipPct = pick([0, 15, 20]); const tipCents = Math.round(subtotalCents * tipPct / 100);
          const totalCents = subtotalCents + totalFeeCents + tipCents;
          const deliveryStaff = nightStaff.filter((sid) => staffById.get(sid)?.role !== "manager");
          const claimedStaff = deliveryStaff.length > 0 ? pick(deliveryStaff) : pick(staffIds);
          const claimedName = staffById.get(claimedStaff)?.name ?? "Staff";

          await prisma.order.upsert({ where: { id: oid }, update: {}, create: { id: oid, venueId: org.id, code: oCode, sessionId: seId, tableId: table.id, tableCode: table.code, zoneId: table.zoneId, zoneName: table.zoneName, guestName: fn, subtotalCents, discountCents: 0, totalFeeCents, tipCents, totalCents, status: "delivered", placedAt: oTime, claimedByStaffId: claimedStaff, claimedByStaffName: claimedName, items: { create: oItems.map((oi, idx) => ({ id: `${oid}-it-${idx}`, menuItemId: oi.item.id, name: oi.item.name, quantity: oi.qty, unitCents: oi.item.priceCents, modifiers: [] })) }, feeLines: { create: fees.map((fee, idx) => ({ id: `${oid}-fee-${idx}`, feeId: fee.id, feeName: fee.name, feeType: fee.type, feeValue: fee.type === "flat" ? toCents(fee.value) : fee.value, amountCents: fee.type === "flat" ? toCents(fee.value) : Math.round(subtotalCents * fee.value / 100) })) } } });
          nightRevenue += totalCents; nightOrderCount++; totalOrders++;

          // Zone tracking
          if (!zoneRevenue[table.zoneId]) zoneRevenue[table.zoneId] = { revenueCents: 0, orderCount: 0 };
          zoneRevenue[table.zoneId].revenueCents += totalCents; zoneRevenue[table.zoneId].orderCount++;
          for (const oi of oItems) {
            if (!itemSales[oi.item.id]) itemSales[oi.item.id] = { name: oi.item.name, count: 0, revenueCents: 0 };
            itemSales[oi.item.id].count++; itemSales[oi.item.id].revenueCents += oi.item.priceCents;
            if (!categorySales[oi.item.catId]) categorySales[oi.item.catId] = { categoryName: catNameById[oi.item.catId], unitsSold: 0 };
            categorySales[oi.item.catId].unitsSold++;
          }
          if (!staffDeliveries[claimedStaff]) staffDeliveries[claimedStaff] = { name: claimedName, role: staffById.get(claimedStaff)?.role ?? "runner", ordersDelivered: 0, totalMinutes: 0, revenueServedCents: 0 };
          staffDeliveries[claimedStaff].ordersDelivered++; staffDeliveries[claimedStaff].totalMinutes += randInt(3, 12); staffDeliveries[claimedStaff].revenueServedCents += totalCents;
        }
        if (rand() < 0.3) {
          const hrId = `${slug}-hr-${nightStr}-${si}`;
          await prisma.helpRequest.upsert({ where: { id: hrId }, update: {}, create: { id: hrId, venueId: org.id, sessionId: seId, tableCode: table.code, zoneName: table.zoneName, guestName: fn, type: pick([...HELP_TYPES]), status: "resolved", createdAt: sStart } });
          totalHelpRequests++;
        }
      }

      // Tip pool accumulation
      const tipRevenue = nightlyTips[nightStr].poolCents || 0;
      const tipsFromOrders = Math.round(nightRevenue * 0.08);
      nightlyTips[nightStr].poolCents = tipRevenue + tipsFromOrders; // ~8% of revenue as tips

      // ── Incidents (5-15% chance per night) ──
      if (rand() < (isWeekend ? 0.15 : 0.05)) {
        const incId = `${slug}-inc-${nightStr}`; const incTime = new Date(d); incTime.setHours(23 + randInt(0, 4), randInt(0, 59));
        const incType = pick(["altercation", "medical", "medical", "refused-entry", "refused-entry", "theft", "theft", "property-damage", "other"]);
        const severity = incType === "altercation" || incType === "theft" ? "medium" : incType === "medical" ? "low" : pick(["low", "medium", "high"]);
        await prisma.incident.upsert({ where: { id: incId }, update: {}, create: { id: incId, venueId: org.id, businessDate: nightStr, type: incType, severity, occurredAt: incTime, zoneId: pick(zoneIds), tableId: pick(allTables).id, guestProfileId: rand() < 0.4 ? pick(guestProfiles).id : null, involvedStaffIds: [pick(staffIds.filter((_, i) => i < 5))], narrative: `Reported ${incType.replace(/-/g, " ")} at ${pick(zoneNames)}`, actionsTaken: pick(["Guest removed", "Situation monitored", "Police notified", "Manager reviewed footage", "Parties separated, no further action"]), policeInvolved: rand() < 0.1, reportedByStaffId: pick(staffIds), reportedByStaffName: staffById.get(pick(staffIds))?.name ?? "Staff", status: rand() < 0.7 ? "resolved" : "open" } });
        // Incident note (50% chance)
        if (rand() < 0.5) {
          await prisma.incidentNote.upsert({ where: { id: `${incId}-note` }, update: {}, create: { id: `${incId}-note`, incidentId: incId, note: pick(["Followed up with involved parties.", "CCTV footage reviewed — no further action needed.", "Manager debriefed security team.", "Witness statement collected."]), authorStaffId: pick(staffIds.filter((_, i) => i < 2)), authorStaffName: staffById.get(pick(staffIds.filter((_, i) => i < 2)))?.name ?? "Manager" } });
        }
      }

      // ── 86 entries (10% chance per night) ──
      if (rand() < 0.1) {
        const item = pick(allItems.slice(0, 6));
        await prisma.eightySixEntry.upsert({ where: { id: `${slug}-86-${nightStr}` }, update: {}, create: { id: `${slug}-86-${nightStr}`, venueId: org.id, menuItemId: item.id, reason: pick(["Sold out — last bottle sold", "Keg blew", "Supply issue", "Quality rejected"]), byStaffId: pick(staffIds.filter((_, i) => i < 4)), at: new Date(d.getTime() + randInt(22, 28) * 3600000) } });
      }

      // ── Reservations ──
      const resCount = isWeekend ? randInt(2, 5) : randInt(0, 2);
      for (let ri = 0; ri < resCount; ri++) {
        const rid = `${slug}-res-${nightStr}-${ri}`; const rTime = new Date(d); rTime.setHours(22, 0, 0, 0);
        const isPublic = rand() < 0.4; const channel = isPublic ? pick(["embed", "direct", "embed"]) : "walk-in";
        const status = pick([ReservationStatus.completed, ReservationStatus.completed, ReservationStatus.completed, ReservationStatus.no_show, ReservationStatus.confirmed]);
        const table = rand() < 0.7 ? pick(allTables) : null;
        const gp = rand() < 0.4 ? pick(guestProfiles) : null;
        await prisma.reservation.upsert({ where: { id: rid }, update: {}, create: { id: rid, venueId: org.id, guestName: gp?.displayName ?? `${pick(GUEST_FIRST_NAMES)} party`, partySize: randInt(4, 12), startsAt: rTime, status, zoneId: table?.zoneId ?? pick(zoneIds), tableId: table?.id ?? null, source: isPublic ? "public" : "manager", channel, guestEmail: isPublic ? `${pick(GUEST_FIRST_NAMES).toLowerCase()}@example.com` : null, guestPhone: rand() < 0.3 ? `+1 555 ${String(ri).padStart(4, "0")}` : null, reservationPin: status === "confirmed" ? seededPin(rid) : null, guestProfileId: gp?.id, expectedDurationMinutes: randInt(120, 240), seatingNumber: rand() < 0.3 ? (pick([1, 2]) as number) : null, createdAt: rTime } });
        totalReservations++;
        if (gp) await prisma.guestLink.upsert({ where: { id: `${rid}-gl` }, update: {}, create: { id: `${rid}-gl`, venueId: org.id, guestProfileId: gp.id, reservationId: rid } });
      }

      // ── Stock movements (waste, transfers) ──
      if (rand() < 0.15) {
        const wasteItem = pick(allItems.slice(0, 6));
        await prisma.stockMovement.upsert({ where: { id: `${slug}-waste-${nightStr}` }, update: {}, create: { id: `${slug}-waste-${nightStr}`, venueId: org.id, menuItemId: wasteItem.id, itemName: wasteItem.name, type: "waste", delta: -randInt(1, 3), note: pick(["Bottle broken behind bar", "Spilled during service", "Returned by guest — open bottle"]), wasteReason: pick(["breakage", "spill", "comp-prep"]), unitCostCents: Math.round(wasteItem.priceCents * 0.35) } });
      }

      // ── Nightly rollup ──
      const rollupId = `${slug}-rollup-${nightStr}`;
      const byZone = { v: 1, zones: Object.entries(zoneRevenue).map(([zid, data]) => ({ zoneId: zid, zoneName: zoneNames[zoneIds.indexOf(zid)] ?? "Unknown", revenueCents: data.revenueCents, orderCount: data.orderCount })) };
      const topItems = { v: 1, items: Object.values(itemSales).sort((a, b) => b.revenueCents - a.revenueCents).slice(0, 10).map((i) => ({ name: i.name, count: i.count, revenueCents: i.revenueCents })) };
      const staffPerf = { v: 1, staff: Object.entries(staffDeliveries).map(([sid, s]) => ({ staffId: sid, name: s.name, role: s.role, ordersDelivered: s.ordersDelivered, avgDeliveryMinutes: s.ordersDelivered > 0 ? Math.round(s.totalMinutes / s.ordersDelivered) : 0, revenueServedCents: s.revenueServedCents })) };
      const catDepletion = { v: 1, categories: Object.entries(categorySales).map(([cid, c]) => ({ categoryId: cid, categoryName: c.categoryName, unitsSold: c.unitsSold })) };
      await prisma.nightlyRollup.upsert({ where: { venueId_nightDate: { venueId: org.id, nightDate: nightStr } }, update: { revenueCents: nightRevenue, orderCount: nightOrderCount, avgOrderCents: nightOrderCount > 0 ? Math.round(nightRevenue / nightOrderCount) : 0, byZone: byZone as unknown as Prisma.InputJsonValue, topItems: topItems as unknown as Prisma.InputJsonValue, staffPerformance: staffPerf as unknown as Prisma.InputJsonValue, categoryDepletion: catDepletion as unknown as Prisma.InputJsonValue }, create: { id: rollupId, venueId: org.id, nightDate: nightStr, revenueCents: nightRevenue, orderCount: nightOrderCount, avgOrderCents: nightOrderCount > 0 ? Math.round(nightRevenue / nightOrderCount) : 0, byZone: byZone as unknown as Prisma.InputJsonValue, topItems: topItems as unknown as Prisma.InputJsonValue, staffPerformance: staffPerf as unknown as Prisma.InputJsonValue, categoryDepletion: catDepletion as unknown as Prisma.InputJsonValue } });

      d.setDate(d.getDate() + 1);
    }

    // ── Tip distributions (one per business date) ──
    for (const [nightStr, tipData] of Object.entries(nightlyTips)) {
      if (tipData.poolCents <= 0 || Object.keys(tipData.staffMinutes).length === 0) continue;
      const tdId = `${slug}-td-${nightStr}`;
      const lines = Object.entries(tipData.staffMinutes).map(([sid, mins]) => ({ staffId: sid, basisValue: mins, shareCents: 0 }));
      const totalBasis = lines.reduce((s, l) => s + l.basisValue, 0);
      let allocated = 0;
      const rems = lines.map((l) => { const exact = (l.basisValue / totalBasis) * tipData.poolCents; const floor = Math.floor(exact); return { ...l, rem: exact - floor, shareCents: floor }; });
      allocated = rems.reduce((s, l) => s + l.shareCents, 0);
      rems.sort((a, b) => b.rem - a.rem);
      for (let i = 0; i < tipData.poolCents - allocated; i++) rems[i % rems.length].shareCents += 1;
      const cleanLines = rems.map(({ staffId, basisValue, shareCents }) => ({ staffId, basisValue, shareCents }));
      const d = new Date(nightStr + "T00:00:00");
      await prisma.tipDistribution.upsert({ where: { id: tdId }, update: {}, create: { id: tdId, venueId: org.id, businessDate: nightStr, ruleId: tipRuleId, poolCents: tipData.poolCents, lines: cleanLines, computedAt: new Date(d.getTime() + 75600000), closedByStaffId: pick(staffIds.filter((_, i) => i < 3)) } });
    }

    // ── Commission statements (monthly for promoters) ──
    for (const s of staffUsers.filter((s) => s.role === "promoter")) {
      const months = [new Date(endDate.getFullYear(), endDate.getMonth() - 2, 1), new Date(endDate.getFullYear(), endDate.getMonth() - 1, 1), new Date(endDate.getFullYear(), endDate.getMonth(), 1)];
      for (const monthStart of months) {
        const periodEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59);
        if (periodEnd > endDate) continue;
        const csId = `${slug}-cs-${s.userId.slice(0, 8)}-${nightDate(monthStart)}`;
        const attributedSessions = randInt(2, 8);
        const lines: { sourceType: string; sourceId: string; basisCents: number; earnedCents: number }[] = [];
        let totalCents = 0;
        for (let ai = 0; ai < attributedSessions; ai++) {
          const basis = randInt(50000, 300000);
          const earned = Math.round(basis * 0.10);
          lines.push({ sourceType: "session", sourceId: `${slug}-gs-comm-${monthStart.getMonth()}-${ai}`, basisCents: basis, earnedCents: earned });
          totalCents += earned;
        }
        await prisma.commissionStatement.upsert({ where: { id: csId }, update: {}, create: { id: csId, venueId: org.id, staffId: s.userId, periodStart: monthStart, periodEnd, lines, totalCents, status: monthStart.getMonth() === endDate.getMonth() ? "draft" : "approved", approvedByStaffId: monthStart.getMonth() !== endDate.getMonth() ? pick(staffIds.filter((_, i) => i < 2)) : null } });
      }
    }

    // ── Coat check tickets ──
    for (let ci = 0; ci < 20; ci++) {
      const ccDate = new Date(endDate); ccDate.setDate(ccDate.getDate() - randInt(0, 90));
      if (!isOpenNight(ccDate, tenantDef.openingHours)) continue;
      const ccId = `${slug}-cc-${ci}`; const claimed = rand() < 0.6;
      await prisma.coatCheckTicket.upsert({ where: { id: ccId }, update: {}, create: { id: ccId, venueId: org.id, businessDate: nightDate(ccDate), ticketNumber: 100 + ci, guestProfileId: rand() < 0.3 ? pick(guestProfiles).id : null, itemCount: randInt(1, 3), checkedInAt: new Date(ccDate.getTime() + (22 + randInt(0, 3)) * 3600000), claimedAt: claimed ? new Date(ccDate.getTime() + (23 + randInt(0, 4)) * 3600000) : null, staffId: pick(staffIds) } });
    }

    console.log(`  Guest profiles: ${guestProfiles.length}, items: ${allItems.length}`);
    console.log(`  Activity: ${totalOrders} orders, ${totalSessions} sessions, ${totalReservations} reservations, ${totalHelpRequests} help requests`);
  }

  console.log(`\nStaging seed complete. Password: ${DEMO_PASSWORD}`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
