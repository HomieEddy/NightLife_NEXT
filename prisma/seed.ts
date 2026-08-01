import type { Prisma, StaffRole } from "@prisma/client";
import { betterAuth } from "better-auth";
import { organization, admin, bearer } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { mockVenue, mockZones, mockTables } from "../src/features/venue/mock-data";
import {
  mockCategories,
  mockMenuItems,
  mockPackages,
  mockStockMovements,
  mockHappyHourRules,
} from "../src/features/menu/mock-data";
import { toCents } from "../src/features/shared/money";
import { getDb, getRawPrisma } from "../src/features/shared/db";
import { ensureMapPositions } from "../src/features/venue/core";
import { CORPUS_ROSTER, PLATFORM_ADMIN, DEMO_PASSWORD } from "../src/lib/seed-corpus";

/**
 * Bartenders only work the bar, hosts only work VIP, runners float
 * everywhere (busser-style) — an empty list means "unrestricted".
 */
function zoneIdsForRole(role: StaffRole): string[] {
  if (role === "bartender") return ["zone-bar"];
  if (role === "host") return ["zone-vip"];
  if (role === "security") return [];   // security floats — no fixed zone
  if (role === "promoter") return [];   // promoter floats — no fixed zone
  return [];
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
    // bearer() lets this headless script authenticate createOrganization/addMember
    // via `Authorization: Bearer <token>` — the browser client uses cookies instead.
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

  // ── Tenant ────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: "luxe-noir" },
    update: {},
    create: {
      name: "LUXE Noir",
      slug: "luxe-noir",
      plan: "pro",
      status: "active",
    },
  });
  console.log(`Tenant: ${tenant.name} (${tenant.id})`);

  // ── Demo users ────────────────────────────────────────────────────
  const amara = await seedUser("Amara Diallo", "amara@velvetmtl.club");
  console.log(`User: Amara Diallo (${amara.user.id})`);

  const nina = await seedUser("Nina Kovač", "nina@velvetmtl.club");
  console.log(`User: Nina Kovač (${nina.user.id})`);

  // Floor roster from canonical seed corpus — excludes manager (Amara, seeded above)
  // and runner (Nina, also seeded above). Remaining: bartenders, runners, hosts, security.
  const floorRoster = CORPUS_ROSTER.filter(
    (m) => m.id !== "st-amara" && m.id !== "st-nina"
  ).map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role as StaffRole,
    initials: m.initials,
    phone: m.phone,
    nights: m.nights,
    hourlyRateCents: m.hourlyRateCents,
    tipPoolWeight: m.tipPoolWeight,
    employmentType: m.employmentType,
    assignedZoneIds: m.assignedZoneIds,
  }));
  const floorStaff: { userId: string; staff: (typeof floorRoster)[number] }[] = [];
  for (const staff of floorRoster) {
    const result = await seedUser(staff.name, staff.email);
    floorStaff.push({ userId: result.user.id, staff });
    console.log(`User: ${staff.name} (${result.user.id})`);
  }

  const adminUser = await seedUser(PLATFORM_ADMIN.name, PLATFORM_ADMIN.email);
  await prisma.user.update({
    where: { id: adminUser.user.id },
    data: { isPlatformAdmin: true, role: "admin" },
  });
  console.log(`User: ${PLATFORM_ADMIN.name} (${adminUser.user.id}) [isPlatformAdmin]`);

  // ── Organization (= venue) ────────────────────────────────────────
  const org = await prisma.organization.findUnique({ where: { slug: "velvet-mtl" } })
    ?? await seedAuth.api.createOrganization({
      headers: new Headers({ authorization: `Bearer ${amara.token}` }),
      body: {
        name: "Velvet Montréal",
        slug: "velvet-mtl",
      },
    });
  console.log(`Organization: Velvet Montréal (${org.id})`);

  // Add Nina + the rest of the floor roster as members
  const nonManagerStaff = [
    { userId: nina.user.id },
    ...floorStaff.map((s) => ({ userId: s.userId })),
  ];
  for (const s of nonManagerStaff) {
    const membership = await prisma.member.findFirst({
      where: { userId: s.userId, organizationId: org.id },
    });
    if (!membership) {
      await seedAuth.api.addMember({
        headers: new Headers({ authorization: `Bearer ${amara.token}` }),
        body: {
          userId: s.userId,
          organizationId: org.id,
          role: "member",
        },
      });
    }
  }
  console.log(`Member: ${nonManagerStaff.length} floor staff added to Velvet Montréal`);

  // ── Staff profiles ────────────────────────────────────────────────
  await prisma.staffProfile.upsert({
    where: { userId: amara.user.id },
    update: { role: "manager" },
    create: {
      userId: amara.user.id,
      role: "manager",
      phone: "+33 6 12 34 56 78",
      avatarInitials: "AD",
      assignedZoneIds: [],
      isOnShift: true,
      hourlyRateCents: 2500,
      tipPoolWeight: 1.0,
      employmentType: "salaried",
    },
  });

  await prisma.staffProfile.upsert({
    where: { userId: nina.user.id },
    update: { role: "runner" },
    create: {
      userId: nina.user.id,
      role: "runner",
      phone: "+33 6 98 76 54 32",
      avatarInitials: "NK",
      assignedZoneIds: zoneIdsForRole("runner"),
      isOnShift: true,
      hourlyRateCents: 1800,
      tipPoolWeight: 1.0,
      employmentType: "hourly",
    },
  });

  for (const s of floorStaff) {
    await prisma.staffProfile.upsert({
      where: { userId: s.userId },
      update: { role: s.staff.role, assignedZoneIds: zoneIdsForRole(s.staff.role) },
      create: {
        userId: s.userId,
        role: s.staff.role,
        phone: s.staff.phone,
        avatarInitials: s.staff.initials,
        assignedZoneIds: zoneIdsForRole(s.staff.role),
        isOnShift: true,
        hourlyRateCents: s.staff.hourlyRateCents,
        tipPoolWeight: s.staff.tipPoolWeight,
        employmentType: s.staff.employmentType,
      },
    });
  }

  console.log(`Staff profiles seeded: 1 manager, 2 bartenders, 3 runners, 3 hosts, 1 security`);

  // ── Venue config (1:1 with the organization) ──────────────────────
  await prisma.venue.upsert({
    where: { id: org.id },
    update: {},
    create: {
      id: org.id,
      address: mockVenue.address,
      city: mockVenue.city,
      timezone: mockVenue.timezone,
      currency: mockVenue.currency,
      openingHours: mockVenue.openingHours as unknown as Prisma.InputJsonValue,
      serviceFees: mockVenue.serviceFees as unknown as Prisma.InputJsonValue,
      floorMap: mockVenue.floorMap as unknown as Prisma.InputJsonValue,
      autoApproveGuests: mockVenue.autoApproveGuests,
      logoInitials: mockVenue.logoInitials,
      slaThresholds: mockVenue.slaThresholds as unknown as Prisma.InputJsonValue,
      lastCallAutoFlagTables: mockVenue.lastCallAutoFlagTables,
      tipPresets: mockVenue.tipPresets as unknown as Prisma.InputJsonValue,
      defaultTipPct: mockVenue.defaultTipPct,
      nightStartHour: mockVenue.nightStartHour,
      nightEndHour: mockVenue.nightEndHour,
      compThresholdCents: mockVenue.compThresholdCents,
      minimumSpendWarningRatio: mockVenue.minimumSpendWarningRatio,
      legalCapacity: mockVenue.legalCapacity,
      occupancyWarnRatio: mockVenue.occupancyWarnRatio,
      coatCheckEnabled: mockVenue.coatCheckEnabled,
      doorRequiresIdCheck: mockVenue.doorRequiresIdCheck,
    },
  });
  console.log(`Venue config seeded for ${org.name}`);

  // ── Zones ──────────────────────────────────────────────────────────
  for (const zone of mockZones) {
    await prisma.zone.upsert({
      where: { id: zone.id },
      update: {},
      create: {
        id: zone.id,
        venueId: org.id,
        name: zone.name,
        description: zone.description,
        color: zone.color,
      },
    });
  }
  console.log(`${mockZones.length} zones seeded`);

  // ── Tables ───────────────────────────────────────────────────────
  for (const table of mockTables) {
    await prisma.venueTable.upsert({
      where: { id: table.id },
      update: {},
      create: {
        id: table.id,
        venueId: org.id,
        zoneId: table.zoneId,
        code: table.code,
        label: table.label,
        seats: table.seats,
        minimumSpend: table.minimumSpend,
        status: table.status as any,
        qrSlug: table.qrSlug,
        mapX: table.mapX,
        mapY: table.mapY,
      },
    });
  }
  console.log(`${mockTables.length} tables seeded`);

  // Mock table fixtures don't carry map positions — lay them out same as createTable would.
  await ensureMapPositions(getDb({ venueId: org.id }));
  console.log(`Floor-map positions computed`);

  // ── Shifts — the venue is only open Thu/Fri/Sat; end time follows that
  // night's close (Thu closes earlier than the weekend). Bartenders/hosts
  // are scheduled on their assigned zone, runners/manager float (no zoneId).
  const CLOSE_TIME_BY_DAY: Record<number, string> = { 4: "04:00", 5: "06:00", 6: "06:00" };
  const shiftPlans: { userId: string; role: StaffRole; nights: number[] }[] = [
    { userId: amara.user.id, role: "manager", nights: [4, 5, 6] },
    { userId: nina.user.id, role: "runner", nights: [4, 5, 6] },
    ...floorStaff.map((s) => ({ userId: s.userId, role: s.staff.role, nights: s.staff.nights })),
  ];
  // Regenerated fresh each run — old ids (e.g. from a previous roster shape) would
  // otherwise linger as stale duplicate shifts.
  await prisma.staffShift.deleteMany({ where: { venueId: org.id } });
  let seededShiftCount = 0;
  for (const plan of shiftPlans) {
    const zoneId = zoneIdsForRole(plan.role)[0] ?? null;
    for (const dayOfWeek of plan.nights) {
      const id = `sh-${plan.userId}-${dayOfWeek}`;
      await prisma.staffShift.upsert({
        where: { id },
        update: {},
        create: {
          id,
          venueId: org.id,
          staffId: plan.userId,
          dayOfWeek,
          startTime: "21:00",
          endTime: CLOSE_TIME_BY_DAY[dayOfWeek],
          zoneId,
        },
      });
      seededShiftCount += 1;
    }
  }
  console.log(`${seededShiftCount} shifts seeded across ${shiftPlans.length} staff`);

  // ── Menu categories ──────────────────────────────────────────────────
  for (const cat of mockCategories) {
    await prisma.menuCategory.upsert({
      where: { id: cat.id },
      update: {},
      create: {
        id: cat.id,
        venueId: org.id,
        name: cat.name,
        description: cat.description,
        sortOrder: cat.sortOrder,
        isActive: cat.isActive,
        modifierGroups: cat.modifierGroups as unknown as Prisma.InputJsonValue,
      },
    });
  }
  console.log(`${mockCategories.length} menu categories seeded`);

  // ── Menu items ──────────────────────────────────────────────────────
  for (const item of mockMenuItems) {
    await prisma.menuItem.upsert({
      where: { id: item.id },
      update: {},
      create: {
        id: item.id,
        venueId: org.id,
        categoryId: item.categoryId,
        name: item.name,
        description: item.description,
        priceCents: toCents(item.price),
        icon: item.icon,
        tags: item.tags,
        isAvailable: item.isAvailable,
        inventory: item.inventory,
      },
    });
  }
  console.log(`${mockMenuItems.length} menu items seeded`);

  // ── Stock movements (initial seed) ──────────────────────────────────
  for (const mv of mockStockMovements) {
    await prisma.stockMovement.upsert({
      where: { id: mv.id },
      update: {},
      create: {
        id: mv.id,
        venueId: org.id,
        menuItemId: mv.menuItemId,
        itemName: mv.itemName,
        type: mv.type,
        delta: mv.delta,
        note: mv.note,
      },
    });
  }
  console.log(`${mockStockMovements.length} stock movements seeded`);

  // ── Packages ────────────────────────────────────────────────────────
  for (const pkg of mockPackages) {
    await prisma.bottlePackage.upsert({
      where: { id: pkg.id },
      update: {},
      create: {
        id: pkg.id,
        venueId: org.id,
        name: pkg.name,
        description: pkg.description,
        priceCents: toCents(pkg.price),
        isActive: pkg.isActive,
        modifierGroups: pkg.modifierGroups as unknown as Prisma.InputJsonValue,
        components: {
          create: pkg.components.map((c) => ({
            itemId: c.menuItemId,
            quantity: c.quantity,
          })),
        },
      },
    });
  }
  console.log(`${mockPackages.length} packages seeded`);

  // ── Happy hour rules ────────────────────────────────────────────────
  for (const rule of mockHappyHourRules) {
    await prisma.happyHourRule.upsert({
      where: { id: rule.id },
      update: {},
      create: {
        id: rule.id,
        venueId: org.id,
        name: rule.name,
        daysOfWeek: rule.daysOfWeek,
        startTime: rule.startTime,
        endTime: rule.endTime,
        discountPct: rule.discountPct,
        appliesToCategoryIds: rule.appliesToCategoryIds,
        isActive: rule.isActive,
      },
    });
  }
  console.log(`${mockHappyHourRules.length} happy hour rules seeded`);

  // ── Second tenant: Le Cercle (for multi-tenant admin/isolation demo) ──
  const tenant2 = await prisma.tenant.upsert({
    where: { slug: "le-cercle" },
    update: {},
    create: { name: "Le Cercle", slug: "le-cercle", plan: "pro", status: "active" },
  });
  console.log(`Tenant: ${tenant2.name} (${tenant2.id})`);

  const celeste = await seedUser("Celeste Moreau", "celeste@lecercle.mtl");
  console.log(`User: Celeste Moreau (${celeste.user.id})`);

  const org2 = await prisma.organization.findUnique({ where: { slug: "le-cercle" } })
    ?? await seedAuth.api.createOrganization({
      headers: new Headers({ authorization: `Bearer ${celeste.token}` }),
      body: { name: "Le Cercle Montréal", slug: "le-cercle" },
    });
  console.log(`Organization: Le Cercle Montréal (${org2.id})`);

  await prisma.staffProfile.upsert({
    where: { userId: celeste.user.id },
    update: { role: "manager" },
    create: {
      userId: celeste.user.id,
      role: "manager",
      phone: "+1 514 555 0199",
      avatarInitials: "CM",
      assignedZoneIds: [],
      isOnShift: true,
      hourlyRateCents: 2200,
      tipPoolWeight: 1.0,
      employmentType: "salaried",
    },
  });

  await prisma.venue.upsert({
    where: { id: org2.id },
    update: {},
    create: {
      id: org2.id,
      address: "378 Rue Saint-Paul Ouest",
      city: "Montréal",
      timezone: "America/Montreal",
      currency: "CAD",
      openingHours: [
        { day: "Friday", open: "22:00", close: "06:00" },
        { day: "Saturday", open: "22:00", close: "06:00" },
      ] as unknown as Prisma.InputJsonValue,
      serviceFees: [
        { id: "fee-service", name: "Service", type: "percentage", value: 5 },
        { id: "fee-tps", name: "TPS", type: "percentage", value: 5 },
        { id: "fee-tvq", name: "TVQ", type: "percentage", value: 9.975 },
      ] as unknown as Prisma.InputJsonValue,
      floorMap: { width: 16, height: 9 } as unknown as Prisma.InputJsonValue,
      autoApproveGuests: false,
      logoInitials: "LC",
      slaThresholds: { orderWarnMinutes: 8, orderCriticalMinutes: 15, helpWarnMinutes: 5, helpCriticalMinutes: 10 } as unknown as Prisma.InputJsonValue,
      lastCallAutoFlagTables: true,
      tipPresets: [15, 18, 20] as unknown as Prisma.InputJsonValue,
      defaultTipPct: 18,
      nightStartHour: 20,
      nightEndHour: 8,
      compThresholdCents: 5000,
      minimumSpendWarningRatio: 0.3,
      legalCapacity: 250,
      occupancyWarnRatio: 0.85,
      coatCheckEnabled: false,
      doorRequiresIdCheck: true,
    },
  });
  console.log("Le Cercle venue config seeded (weekends only, 250-capacity supper-club)");

  // Seed a few tables for the second venue so the admin venue view has substance
  const cercleZones = [
    { id: "lc-main", name: "Main Room", description: "Intimate dance floor", color: "red" },
    { id: "lc-lounge", name: "Lounge", description: "Leather banquettes", color: "amber" },
  ];
  for (const z of cercleZones) {
    await prisma.zone.upsert({
      where: { id: z.id },
      update: {},
      create: { id: z.id, venueId: org2.id, name: z.name, description: z.description, color: z.color },
    });
  }
  for (let ti = 1; ti <= 10; ti++) {
    const zid = ti <= 5 ? "lc-main" : "lc-lounge";
    const tid = `lc-t${ti}`;
    await prisma.venueTable.upsert({
      where: { id: tid },
      update: {},
      create: {
        id: tid, venueId: org2.id, zoneId: zid,
        code: `LC-${String(ti).padStart(2, "0")}`,
        label: `${zid === "lc-main" ? "Main" : "Lounge"} ${ti}`,
        seats: zid === "lc-main" ? 6 : 10,
        minimumSpend: zid === "lc-lounge" ? 400 : 0,
        status: "open" as any,
        qrSlug: `le-cercle-table-${ti}`,
      },
    });
  }
  console.log("Le Cercle: 2 zones, 10 tables seeded");

  // ── Platform leads (pipeline for /admin/leads) ──
  const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);
  const leads = [
    { id: "lead-1", venueName: "Le Kung Fu", contactName: "Alexandre Dubois", email: "alex@lekungfu.ca", phone: "+1 514 555 1001", city: "Montréal", status: "new", source: "landing-page", dealValue: 2988, notes: "400-cap venue, wants QR ordering for VIP only.", createdAt: daysAgo(1), activity: [{ text: "Submitted demo request via landing page", at: daysAgo(1) }] },
    { id: "lead-2", venueName: "La Voûte", contactName: "Jade Okafor", email: "jade@lavoute.ca", phone: "+1 438 555 2002", city: "Montréal", status: "contacted", source: "referral", dealValue: 2988, notes: "Referred by Velvet Room. Interested in runner zone routing.", createdAt: daysAgo(3), activity: [{ text: "Referral intro from Velvet Room owner", at: daysAgo(3) }, { text: "Intro call done — sending pricing deck", at: daysAgo(2) }] },
    { id: "lead-3", venueName: "Bar Ste-Catherine", contactName: "Émilie Garcia", email: "emilie@barstecatherine.ca", phone: "+1 514 555 3003", city: "Montréal", status: "demo", source: "landing-page", dealValue: 4200, notes: "Rooftop venue, terrace-heavy layout.", createdAt: daysAgo(6), activity: [{ text: "Landing page signup", at: daysAgo(6) }, { text: "Qualification call — 21 tables, 3 zones", at: daysAgo(4) }, { text: "Demo booked for Friday 15:00", at: daysAgo(1) }] },
    { id: "lead-4", venueName: "Le Rouge", contactName: "Pierre Dubois", email: "pierre@lerouge.ca", phone: "+1 450 555 4004", city: "Laval", status: "negotiating", source: "event", dealValue: 10788, notes: "Wants enterprise plan with multi-floor zones. Legal reviewing MSA.", createdAt: daysAgo(12), activity: [{ text: "Met at NightTech Expo Paris", at: daysAgo(12) }, { text: "On-site walkthrough of both floors", at: daysAgo(8) }, { text: "Sent enterprise MSA to legal", at: daysAgo(3) }] },
    { id: "lead-5", venueName: "Jardin Neon", contactName: "Lisa Chen", email: "lisa@jardinneon.ca", phone: "+1 514 555 5005", city: "Montréal", status: "won", source: "outbound", dealValue: 1788, notes: "Signed! Provisioning scheduled.", createdAt: daysAgo(18), activity: [{ text: "Cold outreach — replied same day", at: daysAgo(18) }, { text: "Demo + trial started", at: daysAgo(10) }, { text: "Contract signed — starter annual", at: daysAgo(4) }] },
    { id: "lead-6", venueName: "Plage Pulse", contactName: "Nikos Papadopoulos", email: "nikos@plagepulse.ca", phone: "+1 514 555 6006", city: "Montréal", status: "lost", source: "landing-page", dealValue: 2988, notes: "Went with competitor on pricing. Revisit next season.", createdAt: daysAgo(25), activity: [{ text: "Landing page signup", at: daysAgo(25) }, { text: "Demo done — price sensitivity flagged", at: daysAgo(20) }, { text: "Lost to competitor. Re-engage in April.", at: daysAgo(15) }] },
  ];
  for (const lead of leads) {
    await prisma.lead.upsert({ where: { id: lead.id }, update: {}, create: { id: lead.id, venueName: lead.venueName, contactName: lead.contactName, email: lead.email, phone: lead.phone, city: lead.city, status: lead.status, source: lead.source, dealValue: lead.dealValue, notes: lead.notes, createdAt: lead.createdAt } });
    for (const act of lead.activity) {
      await prisma.leadActivity.upsert({ where: { id: `${lead.id}-${act.text.slice(0, 20).replace(/\s/g, "-").toLowerCase()}` }, update: {}, create: { leadId: lead.id, text: act.text, createdAt: act.at } });
    }
  }
  console.log(`${leads.length} leads with activity seeded`);

  // ── VIP tier benefits (for LUXE Noir) ──
  const vipBenefits = [
    { tier: "vip", benefit: "Priority bottle-service presentation", category: "bottle-service", sortOrder: 1 },
    { tier: "vip", benefit: "Dedicated VIP host for the night", category: "service", sortOrder: 2 },
    { tier: "vip", benefit: "Guaranteed VIP-section table", category: "reservation", sortOrder: 3 },
    { tier: "vip", benefit: "Skip-the-line entry for you and your party", category: "admission", sortOrder: 4 },
    { tier: "host-list", benefit: "Priority reservation access", category: "reservation", sortOrder: 1 },
    { tier: "host-list", benefit: "Expedited check-in at the door", category: "admission", sortOrder: 2 },
    { tier: "regular", benefit: "Birthday celebration acknowledgment", category: "service", sortOrder: 1 },
    { tier: "regular", benefit: "Standard bottle presentation", category: "bottle-service", sortOrder: 2 },
  ];
  for (let vi = 0; vi < vipBenefits.length; vi++) {
    const vb = vipBenefits[vi];
    await prisma.vipTierBenefit.upsert({ where: { id: `luxe-vtb-${vi}` }, update: {}, create: { id: `luxe-vtb-${vi}`, venueId: org.id, tier: vb.tier, benefit: vb.benefit, category: vb.category, sortOrder: vb.sortOrder, active: true } });
    await prisma.vipTierBenefit.upsert({ where: { id: `cercle-vtb-${vi}` }, update: {}, create: { id: `cercle-vtb-${vi}`, venueId: org2.id, tier: vb.tier, benefit: vb.benefit, category: vb.category, sortOrder: vb.sortOrder, active: true } });
  }
  console.log(`${vipBenefits.length * 2} VIP tier benefits seeded`);

  // ── Telemetry links (platform-level, no venueId) ──
  const telLinks = [
    { id: "tel-1", name: "Sentry — errors", url: "https://sentry.io/organizations/nightlifenext", category: "monitoring" },
    { id: "tel-2", name: "Grafana — API dashboards", url: "https://grafana.nightlifenext.app", category: "monitoring" },
    { id: "tel-3", name: "Better Stack — logs", url: "https://logs.betterstack.com", category: "logs" },
    { id: "tel-4", name: "Vercel — deployments", url: "https://vercel.com/nightlifenext", category: "infra" },
  ];
  for (const tel of telLinks) {
    await prisma.telemetryLink.upsert({ where: { id: tel.id }, update: {}, create: tel });
  }
  console.log(`${telLinks.length} telemetry links seeded`);

  console.log(`\nDemo password for all users: ${DEMO_PASSWORD}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
