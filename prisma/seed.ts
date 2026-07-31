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

  console.log(`\nDemo password for all users: ${DEMO_PASSWORD}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
