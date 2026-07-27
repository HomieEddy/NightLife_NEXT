/**
 * Staging seed: 2 fictional tenants with 30 days of business activity.
 *
 * Usage: NEXT_PUBLIC_APP_MODE=live npx tsx prisma/seed-staging.ts
 *
 * Requires the base seed to have run first (platform admin user exists).
 * Each tenant gets a full venue config, menu mirroring mock-data items,
 * and ~30 nights of orders, sessions, help requests, reservations, and
 * nightly rollups.
 */

import type { Prisma, StaffRole } from "@prisma/client";
import { EventStatus, ReservationStatus } from "@prisma/client";
import { betterAuth } from "better-auth";
import { organization, admin, bearer } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { toCents } from "../src/server/money";
import { getDb, getRawPrisma } from "../src/server/db";
import { ensureMapPositions } from "../src/server/venue-core";

const DEMO_PASSWORD = "demo1234";

// ── Deterministic pseudo-random (seeded) ───────────────────────────
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
    currency: "CAD",
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
      { name: "Liam Chen", email: "liam@nyxtoronto.com", role: "manager" as StaffRole, initials: "LC" },
      { name: "Priya Sharma", email: "priya@nyxtoronto.com", role: "bartender" as StaffRole, initials: "PS" },
      { name: "Marcus Lee", email: "marcus@nyxtoronto.com", role: "runner" as StaffRole, initials: "ML" },
      { name: "Sophie Tremblay", email: "sophie@nyxtoronto.com", role: "host" as StaffRole, initials: "ST" },
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
    currency: "EUR",
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
      { name: "Camille Dupont", email: "camille@maisonlyon.fr", role: "manager" as StaffRole, initials: "CD" },
      { name: "Youssef Ben Ali", email: "youssef@maisonlyon.fr", role: "bartender" as StaffRole, initials: "YB" },
      { name: "Léa Martin", email: "lea@maisonlyon.fr", role: "runner" as StaffRole, initials: "LM" },
    ],
  },
] as const;

// Menu items mirroring mock-data — same categories and pricing
const CATEGORIES = [
  { suffix: "champagne", name: "Champagne", sortOrder: 0 },
  { suffix: "tequila", name: "Tequila", sortOrder: 1 },
  { suffix: "vodka", name: "Vodka", sortOrder: 2 },
  { suffix: "cognac", name: "Cognac", sortOrder: 3 },
  { suffix: "whisky", name: "Whisky", sortOrder: 4 },
  { suffix: "gin", name: "Gin", sortOrder: 5 },
];

const MENU_ITEMS = [
  { suffix: "moet", cat: "champagne", name: "Moët Impérial", price: 160, inv: 20 },
  { suffix: "dom", cat: "champagne", name: "Dom Pérignon", price: 320, inv: 8 },
  { suffix: "ace", cat: "champagne", name: "Armand de Brignac", price: 500, inv: 6 },
  { suffix: "patron", cat: "tequila", name: "Patrón Silver", price: 220, inv: 15 },
  { suffix: "don-julio", cat: "tequila", name: "Don Julio 1942", price: 340, inv: 10 },
  { suffix: "clase-azul", cat: "tequila", name: "Clase Azul Reposado", price: 400, inv: 5 },
  { suffix: "titos", cat: "vodka", name: "Tito's Handmade", price: 180, inv: 25 },
  { suffix: "greygoose", cat: "vodka", name: "Grey Goose", price: 220, inv: 18 },
  { suffix: "belvedere", cat: "vodka", name: "Belvedere", price: 300, inv: 10 },
  { suffix: "hennessy", cat: "cognac", name: "Hennessy VS", price: 260, inv: 12 },
  { suffix: "remy", cat: "cognac", name: "Rémy Martin XO", price: 440, inv: 4 },
  { suffix: "macallan", cat: "whisky", name: "Macallan 12", price: 320, inv: 8 },
  { suffix: "jw-blue", cat: "whisky", name: "Johnnie Walker Blue", price: 430, inv: 6 },
  { suffix: "hendricks", cat: "gin", name: "Hendrick's", price: 210, inv: 14 },
  { suffix: "monkey", cat: "gin", name: "Monkey 47", price: 250, inv: 10 },
];

const GUEST_FIRST_NAMES = [
  "Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Quinn",
  "Avery", "Blake", "Charlie", "Dana", "Emery", "Finley", "Harper",
  "Jamie", "Kai", "Logan", "Noel", "Reese", "Sage",
];

const HELP_TYPES = ["call-waiter", "refill-ice", "clean-table", "security", "bill"] as const;
const SETTLEMENT_METHODS = ["terminal", "cash", "house"] as const;

const RESERVATION_NAMES = [
  "Dubois party", "Martinez celebration", "Kim birthday", "Chen group",
  "O'Brien corporate", "Nakamura anniversary", "Singh engagement",
  "Thompson reunion", "Garcia bridal", "Wilson launch party",
];

const RESERVATION_CHANNELS = ["walk-in", "embed", "direct", "embed", "direct"] as const;
const RESERVATION_EMAILS = [
  "dubois@example.com", "martinez@example.com", "kim.j@example.com",
  "group.chen@corp.ca", null, "nakamura@example.com",
  null, "reunion@example.com", "garcia.bridal@example.com", null,
];
const RESERVATION_PHONES = [
  null, null, "+1 514 555 0101",
  null, "+1 416 555 0202", null,
  "+33 6 12 34 56 78", null, null, "+1 438 555 0303",
];

function seededPin(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return String(Math.abs(hash) % 1000000).padStart(6, "0");
}

async function main() {
  const prisma = getRawPrisma();

  const seedAuth = betterAuth({
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    secret: process.env.AUTH_SECRET ?? "seed-secret-at-least-32-characters-long",
    emailAndPassword: { enabled: true },
    user: {
      additionalFields: {
        isPlatformAdmin: {
          type: "boolean" as const,
          defaultValue: false,
          input: false,
        },
      },
    },
    plugins: [organization(), admin(), bearer()],
  });

  async function seedUser(name: string, email: string) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return seedAuth.api.signInEmail({ body: { email, password: DEMO_PASSWORD } });
    }
    return seedAuth.api.signUpEmail({
      body: { name, email, password: DEMO_PASSWORD },
    });
  }

  // ── Date range: 30 business nights ending yesterday ──────────────
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() - 1);

  function nightDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  function isOpenNight(d: Date, openingHours: readonly { day: string }[]): boolean {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayName = days[d.getDay()];
    return openingHours.some((h) => h.day === dayName);
  }

  for (const tenantDef of TENANTS) {
    console.log(`\n── Seeding ${tenantDef.tenantName} ──────────────────`);

    // ── Tenant ────────────────────────────────────────────────────
    const tenant = await prisma.tenant.upsert({
      where: { slug: tenantDef.slug },
      update: {},
      create: {
        name: tenantDef.tenantName,
        slug: tenantDef.slug,
        plan: "pro",
        status: "active",
      },
    });
    console.log(`Tenant: ${tenant.name} (${tenant.id})`);

    // ── Users + org ──────────────────────────────────────────────
    const staffUsers: { userId: string; name: string; role: StaffRole; token: string }[] = [];
    let managerToken = "";

    for (const s of tenantDef.staff) {
      const result = await seedUser(s.name, s.email);
      staffUsers.push({ userId: result.user.id, name: s.name, role: s.role, token: result.token! });
      if (s.role === "manager") managerToken = result.token!;
      console.log(`User: ${s.name} (${result.user.id})`);
    }

    const existingOrg = await prisma.organization.findUnique({ where: { slug: tenantDef.orgSlug } });
    const org = existingOrg ?? await seedAuth.api.createOrganization({
      headers: new Headers({ authorization: `Bearer ${managerToken}` }),
      body: { name: tenantDef.orgName, slug: tenantDef.orgSlug },
    });
    console.log(`Organization: ${org.name} (${org.id})`);

    for (const s of staffUsers) {
      if (s.token === managerToken) continue;
      const membership = await prisma.member.findFirst({
        where: { userId: s.userId, organizationId: org.id },
      });
      if (!membership) {
        await seedAuth.api.addMember({
          headers: new Headers({ authorization: `Bearer ${managerToken}` }),
          body: { userId: s.userId, organizationId: org.id, role: "member" },
        });
      }
    }

    // ── Staff profiles ───────────────────────────────────────────
    for (const s of staffUsers) {
      const def = tenantDef.staff.find((st) => st.email === s.name.toLowerCase().replace(/ /g, "") + "@x")
        ?? tenantDef.staff.find((st) => st.name === s.name)!;
      await prisma.staffProfile.upsert({
        where: { userId: s.userId },
        update: { role: s.role },
        create: {
          userId: s.userId,
          role: s.role,
          phone: "+1 555 000 0000",
          avatarInitials: def.initials,
          assignedZoneIds: [],
          isOnShift: true,
          hourlyRateCents: s.role === "manager" ? 2500 : s.role === "bartender" ? 2200 : 1800,
          tipPoolWeight: 1.0,
          employmentType: "hourly",
        },
      });
    }
    console.log(`Staff profiles seeded`);

    const venueId = org.id;

    // ── Venue config ─────────────────────────────────────────────
    await prisma.venue.upsert({
      where: { id: venueId },
      update: {},
      create: {
        id: venueId,
        address: tenantDef.address,
        city: tenantDef.city,
        timezone: tenantDef.timezone,
        currency: tenantDef.currency,
        openingHours: tenantDef.openingHours as unknown as Prisma.InputJsonValue,
        serviceFees: tenantDef.serviceFees as unknown as Prisma.InputJsonValue,
        floorMap: { width: 16, height: 9 } as unknown as Prisma.InputJsonValue,
        autoApproveGuests: false,
        logoInitials: tenantDef.logoInitials,
        slaThresholds: {
          orderWarnMinutes: 6,
          orderCriticalMinutes: 12,
          helpWarnMinutes: 4,
          helpCriticalMinutes: 8,
        } as unknown as Prisma.InputJsonValue,
        lastCallAutoFlagTables: true,
        tipPresets: [15, 20] as unknown as Prisma.InputJsonValue,
        defaultTipPct: 15,
        nightStartHour: tenantDef.nightStartHour,
        nightEndHour: tenantDef.nightEndHour,
        publicSlug: tenantDef.slug,
        compThresholdCents: 10000,
        minimumSpendWarningRatio: 0.25,
        legalCapacity: 400,
        occupancyWarnRatio: 0.9,
        coatCheckEnabled: true,
        doorRequiresIdCheck: true,
      },
    });
    console.log(`Venue config seeded`);

    // ── Zones + tables ───────────────────────────────────────────
    const zoneIds: string[] = [];
    const zoneNames: string[] = [];
    interface TableRef { id: string; code: string; zoneId: string; zoneName: string }
    const allTables: TableRef[] = [];

    for (let zi = 0; zi < tenantDef.zones.length; zi++) {
      const z = tenantDef.zones[zi];
      const zoneId = `${tenantDef.slug}-zone-${z.suffix}`;
      await prisma.zone.upsert({
        where: { id: zoneId },
        update: {},
        create: { id: zoneId, venueId, name: z.name, description: z.description, color: z.color },
      });
      zoneIds.push(zoneId);
      zoneNames.push(z.name);

      const tableCount = tenantDef.tablesPerZone[zi];
      for (let ti = 1; ti <= tableCount; ti++) {
        const prefix = z.suffix.toUpperCase().slice(0, 3);
        const code = `${prefix}-${String(ti).padStart(2, "0")}`;
        const tableId = `${tenantDef.slug}-t-${z.suffix}-${ti}`;
        await prisma.venueTable.upsert({
          where: { id: tableId },
          update: {},
          create: {
            id: tableId,
            venueId,
            zoneId,
            code,
            label: `${z.name} ${ti}`,
            seats: z.suffix.includes("vip") || z.suffix.includes("priv") ? 8 : 4,
            status: "open",
            qrSlug: `${tenantDef.slug}-${z.suffix}-${ti}`,
          },
        });
        allTables.push({ id: tableId, code, zoneId, zoneName: z.name });
      }
    }
    console.log(`${zoneIds.length} zones, ${allTables.length} tables seeded`);

    // ── Menu categories + items ──────────────────────────────────
    const catIds: Record<string, string> = {};
    const catNameById: Record<string, string> = {};
    for (const cat of CATEGORIES) {
      const catId = `${tenantDef.slug}-cat-${cat.suffix}`;
      catIds[cat.suffix] = catId;
      catNameById[catId] = cat.name;
      await prisma.menuCategory.upsert({
        where: { id: catId },
        update: {},
        create: {
          id: catId,
          venueId,
          name: cat.name,
          description: "",
          sortOrder: cat.sortOrder,
          isActive: true,
          modifierGroups: [],
        },
      });
    }

    interface ItemRef { id: string; name: string; priceCents: number; catId: string }
    const allItems: ItemRef[] = [];

    for (const item of MENU_ITEMS) {
      const itemId = `${tenantDef.slug}-mi-${item.suffix}`;
      const categoryId = catIds[item.cat];
      const priceCents = toCents(item.price);
      await prisma.menuItem.upsert({
        where: { id: itemId },
        update: {},
        create: {
          id: itemId,
          venueId,
          categoryId,
          name: item.name,
          description: "",
          priceCents,
          icon: "wine",
          tags: [],
          isAvailable: true,
          inventory: item.inv,
        },
      });
      allItems.push({ id: itemId, name: item.name, priceCents, catId: categoryId });

      // Initial stock movement
      await prisma.stockMovement.upsert({
        where: { id: `${itemId}-init` },
        update: {},
        create: {
          id: `${itemId}-init`,
          venueId,
          menuItemId: itemId,
          itemName: item.name,
          type: "restock",
          delta: item.inv,
          note: "Initial inventory",
        },
      });
    }
    console.log(`${CATEGORIES.length} categories, ${allItems.length} items seeded`);

    // ── Floor map positions ──────────────────────────────────────
    await ensureMapPositions(getDb({ venueId }));

    // ── Happy hour rules ─────────────────────────────────────────
    const hhRules = [
      {
        id: `${tenantDef.slug}-hh-early`,
        name: "Early Bird Bottles",
        daysOfWeek: [4, 5, 6], // Thu-Sat
        startTime: "22:00",
        endTime: "23:30",
        discountPct: 15,
        appliesToCategoryIds: [catIds["vodka"], catIds["gin"]],
      },
      {
        id: `${tenantDef.slug}-hh-champagne`,
        name: "Champagne Thursdays",
        daysOfWeek: [4],
        startTime: "22:00",
        endTime: "00:00",
        discountPct: 20,
        appliesToCategoryIds: [catIds["champagne"]],
      },
      {
        id: `${tenantDef.slug}-hh-weekend`,
        name: "Weekend Warmup",
        daysOfWeek: [5, 6],
        startTime: "22:30",
        endTime: "23:30",
        discountPct: 10,
        appliesToCategoryIds: [catIds["tequila"], catIds["whisky"]],
      },
    ];
    for (const rule of hhRules) {
      await prisma.happyHourRule.upsert({
        where: { id: rule.id },
        update: {},
        create: { ...rule, venueId, isActive: true },
      });
    }

    // ── Events (mix of ended + upcoming) ─────────────────────────
    const eventDefs = [
      { suffix: "latin-night", name: "Latin Night", daysAgo: 21, capacity: 200, status: EventStatus.ended },
      { suffix: "ladies-night", name: "Ladies' Night", daysAgo: 14, capacity: 150, status: EventStatus.ended },
      { suffix: "dj-showcase", name: "DJ Showcase", daysAgo: 7, capacity: 250, status: EventStatus.ended },
      { suffix: "vip-launch", name: "VIP Launch Party", daysAgo: -3, capacity: 120, status: EventStatus.published },
      { suffix: "nye-preview", name: "Summer Solstice", daysAgo: -10, capacity: 300, status: EventStatus.draft },
    ];
    for (const ev of eventDefs) {
      const eventId = `${tenantDef.slug}-event-${ev.suffix}`;
      const startsAt = new Date(endDate);
      startsAt.setDate(startsAt.getDate() - ev.daysAgo);
      startsAt.setHours(22, 0, 0, 0);
      const endsAt = new Date(startsAt);
      endsAt.setHours(endsAt.getHours() + 5);

      await prisma.venueEvent.upsert({
        where: { id: eventId },
        update: {},
        create: {
          id: eventId,
          venueId,
          name: ev.name,
          description: `${ev.name} at ${tenantDef.orgName}`,
          startsAt,
          endsAt,
          zoneId: pick([...zoneIds]),
          capacity: ev.capacity,
          status: ev.status,
          guestlistEnabled: ev.status !== EventStatus.draft,
        },
      });

      // Add guests to ended/published events
      if (ev.status !== EventStatus.draft) {
        const guestCount = Math.floor(ev.capacity * (0.5 + rand() * 0.4));
        for (let gi = 0; gi < guestCount; gi++) {
          const guestStatus = ev.status === "ended"
            ? pick(["confirmed", "confirmed", "confirmed", "checked_in", "checked_in", "checked_in", "checked_in", "no_show"])
            : pick(["invited", "invited", "confirmed", "confirmed", "confirmed"]);
          await prisma.eventGuest.upsert({
            where: { id: `${eventId}-g-${gi}` },
            update: {},
            create: {
              id: `${eventId}-g-${gi}`,
              eventId,
              name: `Guest ${gi + 1}`,
              partySize: randInt(1, 4),
              status: guestStatus,
            },
          });
        }
      }
    }

    // ── Promotions (mix of active + expired) ─────────────────────
    const promoDefs = [
      { code: "WELCOME20", name: "Welcome 20%", type: "percentage", value: 20, daysAgo: 25, duration: 30 },
      { code: "FRIENDS10", name: "Friends & Family", type: "percentage", value: 10, daysAgo: 15, duration: 20 },
      { code: "VIP50OFF", name: "VIP $50 Off", type: "flat", value: 50, daysAgo: 10, duration: 14 },
      { code: "WEEKEND15", name: "Weekend Special", type: "percentage", value: 15, daysAgo: -2, duration: 7 },
    ];
    for (const promo of promoDefs) {
      const promoId = `${tenantDef.slug}-promo-${promo.code.toLowerCase()}`;
      const startsAt = new Date(endDate);
      startsAt.setDate(startsAt.getDate() - promo.daysAgo);
      const endsAt = new Date(startsAt);
      endsAt.setDate(endsAt.getDate() + promo.duration);

      await prisma.promotion.upsert({
        where: { venueId_code: { venueId, code: promo.code } },
        update: {},
        create: {
          id: promoId,
          venueId,
          code: promo.code,
          name: promo.name,
          type: promo.type,
          value: promo.value,
          appliesToCategoryIds: [],
          startsAt,
          endsAt,
          redemptionCount: promo.daysAgo > 0 ? randInt(5, 30) : 0,
        },
      });
    }
    console.log(`Happy hours, events, promotions seeded`);

    // ── 30 days of business activity ─────────────────────────────
    const fees = tenantDef.serviceFees;
    let orderSeq = 0;
    let totalOrders = 0;
    let totalSessions = 0;
    let totalReservations = 0;
    let totalHelpRequests = 0;

    const d = new Date(endDate);
    d.setDate(d.getDate() - 35); // go back far enough to get ~30 open nights

    while (d <= endDate) {
      if (!isOpenNight(d, tenantDef.openingHours)) {
        d.setDate(d.getDate() + 1);
        continue;
      }

      const nightStr = nightDate(d);
      const dayOfWeek = d.getDay();
      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
      const sessionsTonight = isWeekend ? randInt(8, 16) : randInt(4, 10);

      let nightRevenue = 0;
      let nightOrderCount = 0;
      const zoneRevenue: Record<string, { revenueCents: number; orderCount: number }> = {};
      const itemSales: Record<string, { name: string; count: number; revenueCents: number }> = {};
      const staffDeliveries: Record<string, { name: string; role: string; ordersDelivered: number; totalMinutes: number; revenueServedCents: number }> = {};
      const categorySales: Record<string, { categoryName: string; unitsSold: number }> = {};

      for (let si = 0; si < sessionsTonight; si++) {
        const table = pick(allTables);
        const guestName = pick(GUEST_FIRST_NAMES);
        const partySize = randInt(2, 6);

        // Session times: arrive between 22:00 and 01:00, stay 1-3 hours
        const arriveHour = 22 + randInt(0, 3);
        const sessionStart = new Date(d);
        sessionStart.setHours(arriveHour, randInt(0, 59), 0, 0);

        const sessionEnd = new Date(sessionStart);
        sessionEnd.setHours(sessionEnd.getHours() + randInt(1, 3));

        const sessionId = `${tenantDef.slug}-gs-${nightStr}-${si}`;
        await prisma.guestSession.upsert({
          where: { id: sessionId },
          update: {},
          create: {
            id: sessionId,
            venueId,
            tableId: table.id,
            tableCode: table.code,
            zoneName: table.zoneName,
            displayName: guestName,
            partySize,
            status: "closed",
            settlementMethod: pick([...SETTLEMENT_METHODS]),
            settledExternallyAt: sessionEnd,
            createdAt: sessionStart,
          },
        });
        totalSessions++;

        // 1-3 orders per session
        const ordersInSession = randInt(1, 3);
        for (let oi = 0; oi < ordersInSession; oi++) {
          orderSeq++;
          const orderId = `${tenantDef.slug}-ord-${nightStr}-${orderSeq}`;
          const orderCode = `${String.fromCharCode(65 + (orderSeq % 26))}-${String(orderSeq).padStart(3, "0")}`;

          const orderTime = new Date(sessionStart);
          orderTime.setMinutes(orderTime.getMinutes() + oi * randInt(15, 40));

          // 1-3 items per order
          const itemCount = randInt(1, 3);
          const orderItems: { item: ItemRef; qty: number }[] = [];
          let subtotalCents = 0;

          for (let ii = 0; ii < itemCount; ii++) {
            const item = pick(allItems);
            const qty = 1;
            orderItems.push({ item, qty });
            subtotalCents += item.priceCents * qty;
          }

          // Compute fees
          let totalFeeCents = 0;
          const feeLines: { feeId: string; feeName: string; feeType: string; feeValue: number; amountCents: number }[] = [];
          for (const fee of fees) {
            const amount = fee.type === "flat"
              ? toCents(fee.value)
              : Math.round(subtotalCents * fee.value / 100);
            totalFeeCents += amount;
            feeLines.push({
              feeId: fee.id,
              feeName: fee.name,
              feeType: fee.type,
              feeValue: fee.type === "flat" ? toCents(fee.value) : fee.value,
              amountCents: amount,
            });
          }

          const tipPct = pick([0, 15, 20]);
          const tipCents = Math.round(subtotalCents * tipPct / 100);
          const totalCents = subtotalCents + totalFeeCents + tipCents;

          const deliveryStaff = staffUsers.filter((s) => s.role !== "manager");
          const claimedStaff = deliveryStaff[orderSeq % deliveryStaff.length];

          await prisma.order.upsert({
            where: { id: orderId },
            update: {},
            create: {
              id: orderId,
              venueId,
              code: orderCode,
              sessionId,
              tableId: table.id,
              tableCode: table.code,
              zoneId: table.zoneId,
              zoneName: table.zoneName,
              guestName,
              subtotalCents,
              discountCents: 0,
              totalFeeCents,
              tipCents,
              totalCents,
              status: "delivered",
              placedAt: orderTime,
              claimedByStaffId: claimedStaff.userId,
              claimedByStaffName: claimedStaff.name,
              items: {
                create: orderItems.map((oi, idx) => ({
                  id: `${orderId}-item-${idx}`,
                  menuItemId: oi.item.id,
                  name: oi.item.name,
                  quantity: oi.qty,
                  unitCents: oi.item.priceCents,
                  modifiers: [],
                })),
              },
              feeLines: {
                create: feeLines.map((fl, idx) => ({
                  id: `${orderId}-fee-${idx}`,
                  ...fl,
                })),
              },
            },
          });

          nightRevenue += totalCents;
          nightOrderCount++;
          totalOrders++;

          // Track zone revenue
          if (!zoneRevenue[table.zoneId]) {
            zoneRevenue[table.zoneId] = { revenueCents: 0, orderCount: 0 };
          }
          zoneRevenue[table.zoneId].revenueCents += totalCents;
          zoneRevenue[table.zoneId].orderCount++;

          // Track item sales
          for (const oi of orderItems) {
            if (!itemSales[oi.item.id]) {
              itemSales[oi.item.id] = { name: oi.item.name, count: 0, revenueCents: 0 };
            }
            itemSales[oi.item.id].count += oi.qty;
            itemSales[oi.item.id].revenueCents += oi.item.priceCents * oi.qty;

            // Track category sales
            if (!categorySales[oi.item.catId]) {
              categorySales[oi.item.catId] = { categoryName: catNameById[oi.item.catId], unitsSold: 0 };
            }
            categorySales[oi.item.catId].unitsSold += oi.qty;
          }

          // Track staff deliveries
          const sid = claimedStaff.userId;
          if (!staffDeliveries[sid]) {
            staffDeliveries[sid] = { name: claimedStaff.name, role: claimedStaff.role as string, ordersDelivered: 0, totalMinutes: 0, revenueServedCents: 0 };
          }
          staffDeliveries[sid].ordersDelivered++;
          staffDeliveries[sid].totalMinutes += randInt(3, 12);
          staffDeliveries[sid].revenueServedCents += totalCents;
        }

        // Some sessions have help requests
        if (rand() < 0.3) {
          const hrId = `${tenantDef.slug}-hr-${nightStr}-${si}`;
          await prisma.helpRequest.upsert({
            where: { id: hrId },
            update: {},
            create: {
              id: hrId,
              venueId,
              sessionId,
              tableCode: table.code,
              zoneName: table.zoneName,
              guestName,
              type: pick([...HELP_TYPES]),
              status: "resolved",
              createdAt: sessionStart,
            },
          });
          totalHelpRequests++;
        }
      }

      // Some nights have reservations — mix of manager and public channels
      const resCount = isWeekend ? randInt(2, 5) : randInt(0, 2);
      for (let ri = 0; ri < resCount; ri++) {
        const resId = `${tenantDef.slug}-res-${nightStr}-${ri}`;
        const resTime = new Date(d);
        resTime.setHours(22, 0, 0, 0);
        const nameIdx = (totalReservations + ri) % RESERVATION_NAMES.length;
        const isPublic = rand() < 0.4;
        const source = isPublic ? "public" : "manager";
        const channel = isPublic
          ? RESERVATION_CHANNELS[(totalReservations + ri) % RESERVATION_CHANNELS.length]
          : "walk-in";
        const status = pick([ReservationStatus.confirmed, ReservationStatus.completed, ReservationStatus.completed, ReservationStatus.completed]);
        const table = rand() < 0.7 ? pick(allTables) : null;
        const pin = status === "confirmed" && table ? seededPin(resId) : null;

        await prisma.reservation.upsert({
          where: { id: resId },
          update: {},
          create: {
            id: resId,
            venueId,
            guestName: RESERVATION_NAMES[nameIdx],
            partySize: randInt(4, 12),
            startsAt: resTime,
            status,
            zoneId: table?.zoneId ?? pick(zoneIds),
            tableId: table?.id ?? null,
            source,
            channel,
            guestEmail: isPublic ? RESERVATION_EMAILS[nameIdx] : null,
            guestPhone: isPublic ? RESERVATION_PHONES[nameIdx] : null,
            reservationPin: pin,
            createdAt: resTime,
          },
        });
        totalReservations++;
      }

      // ── Nightly rollup ─────────────────────────────────────────
      const rollupId = `${tenantDef.slug}-rollup-${nightStr}`;
      const byZone = {
        v: 1,
        zones: Object.entries(zoneRevenue).map(([zoneId, data]) => ({
          zoneId,
          zoneName: zoneNames[zoneIds.indexOf(zoneId)] ?? "Unknown",
          revenueCents: data.revenueCents,
          orderCount: data.orderCount,
        })),
      };
      const topItems = {
        v: 1,
        items: Object.values(itemSales)
          .sort((a, b) => b.revenueCents - a.revenueCents)
          .slice(0, 10)
          .map((i) => ({ name: i.name, count: i.count, revenueCents: i.revenueCents })),
      };

      const staffPerf = {
        v: 1,
        staff: Object.entries(staffDeliveries).map(([staffId, s]) => ({
          staffId,
          name: s.name,
          role: s.role,
          ordersDelivered: s.ordersDelivered,
          avgDeliveryMinutes: s.ordersDelivered > 0 ? Math.round(s.totalMinutes / s.ordersDelivered) : 0,
          revenueServedCents: s.revenueServedCents,
        })),
      };
      const catDepletion = {
        v: 1,
        categories: Object.entries(categorySales).map(([categoryId, c]) => ({
          categoryId,
          categoryName: c.categoryName,
          unitsSold: c.unitsSold,
        })),
      };

      await prisma.nightlyRollup.upsert({
        where: { venueId_nightDate: { venueId, nightDate: nightStr } },
        update: {
          revenueCents: nightRevenue,
          orderCount: nightOrderCount,
          avgOrderCents: nightOrderCount > 0 ? Math.round(nightRevenue / nightOrderCount) : 0,
          byZone: byZone as unknown as Prisma.InputJsonValue,
          topItems: topItems as unknown as Prisma.InputJsonValue,
          staffPerformance: staffPerf as unknown as Prisma.InputJsonValue,
          categoryDepletion: catDepletion as unknown as Prisma.InputJsonValue,
        },
        create: {
          id: rollupId,
          venueId,
          nightDate: nightStr,
          revenueCents: nightRevenue,
          orderCount: nightOrderCount,
          avgOrderCents: nightOrderCount > 0 ? Math.round(nightRevenue / nightOrderCount) : 0,
          byZone: byZone as unknown as Prisma.InputJsonValue,
          topItems: topItems as unknown as Prisma.InputJsonValue,
          staffPerformance: staffPerf as unknown as Prisma.InputJsonValue,
          categoryDepletion: catDepletion as unknown as Prisma.InputJsonValue,
        },
      });

      d.setDate(d.getDate() + 1);
    }

    // ── Upcoming reservations (tonight + tomorrow + 2 days out) ──
    const upcomingDefs = [
      { daysOut: 0, source: "manager", channel: "walk-in", status: ReservationStatus.confirmed, nameIdx: 0 },
      { daysOut: 0, source: "public", channel: "embed", status: ReservationStatus.confirmed, nameIdx: 1 },
      { daysOut: 1, source: "public", channel: "embed", status: ReservationStatus.requested, nameIdx: 2 },
      { daysOut: 1, source: "public", channel: "direct", status: ReservationStatus.requested, nameIdx: 3 },
      { daysOut: 1, source: "manager", channel: "walk-in", status: ReservationStatus.confirmed, nameIdx: 4 },
      { daysOut: 2, source: "public", channel: "embed", status: ReservationStatus.requested, nameIdx: 5 },
    ];
    for (const up of upcomingDefs) {
      const upDate = new Date(now);
      upDate.setDate(upDate.getDate() + up.daysOut);
      const resId = `${tenantDef.slug}-res-upcoming-${up.daysOut}-${up.nameIdx}`;
      const resTime = new Date(upDate);
      resTime.setHours(22, 0, 0, 0);
      const table = pick(allTables);
      const pin = up.status === "confirmed" ? seededPin(resId) : null;

      await prisma.reservation.upsert({
        where: { id: resId },
        update: {},
        create: {
          id: resId,
          venueId,
          guestName: RESERVATION_NAMES[up.nameIdx],
          partySize: randInt(4, 10),
          startsAt: resTime,
          status: up.status,
          zoneId: table.zoneId,
          tableId: table.id,
          source: up.source,
          channel: up.channel,
          guestEmail: up.source === "public" ? RESERVATION_EMAILS[up.nameIdx] : null,
          guestPhone: up.source === "public" ? RESERVATION_PHONES[up.nameIdx] : null,
          reservationPin: pin,
          createdAt: new Date(resTime.getTime() - 86400000),
        },
      });
      totalReservations++;
    }
    console.log(`  + ${upcomingDefs.length} upcoming reservations (tonight/tomorrow/+2d)`);

    console.log(`Activity: ${totalOrders} orders, ${totalSessions} sessions, ${totalReservations} reservations, ${totalHelpRequests} help requests`);
    totalOrders = 0;
    totalSessions = 0;
    totalReservations = 0;
    totalHelpRequests = 0;
    orderSeq = 0;
  }

  console.log(`\nStaging seed complete. Password for all users: ${DEMO_PASSWORD}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
