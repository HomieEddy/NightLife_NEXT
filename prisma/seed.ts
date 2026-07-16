import type { Prisma } from "@prisma/client";
import { betterAuth } from "better-auth";
import { organization, admin, bearer } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { mockVenue, mockZones, mockTables } from "../src/lib/mock-data/venue";
import { mockShifts } from "../src/lib/mock-data/staff";
import {
  mockCategories,
  mockMenuItems,
  mockPackages,
  mockStockMovements,
  mockHappyHourRules,
} from "../src/lib/mock-data/menu";
import { toCents } from "../src/server/money";
import { getDb, getRawPrisma } from "../src/server/db";
import { ensureMapPositions } from "../src/server/venue-core";

const DEMO_PASSWORD = "demo1234";

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

  const adminUser = await seedUser("Platform Admin", "admin@nightlifext.com");
  await prisma.user.update({
    where: { id: adminUser.user.id },
    data: { isPlatformAdmin: true, role: "admin" },
  });
  console.log(`User: Platform Admin (${adminUser.user.id}) [isPlatformAdmin]`);

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

  // Add Nina as member
  const ninaMembership = await prisma.member.findFirst({
    where: { userId: nina.user.id, organizationId: org.id },
  });
  if (!ninaMembership) {
    await seedAuth.api.addMember({
      headers: new Headers({ authorization: `Bearer ${amara.token}` }),
      body: {
        userId: nina.user.id,
        organizationId: org.id,
        role: "member",
      },
    });
  }
  console.log(`Member: Nina added to Velvet Montréal`);

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
      assignedZoneIds: [],
      isOnShift: true,
    },
  });

  console.log(`Staff profiles seeded`);

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
      nightStartHour: mockVenue.nightStartHour,
      nightEndHour: mockVenue.nightEndHour,
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
        status: table.status,
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

  // ── Shifts (staffId is a real User FK) ───────────────────────────────
  const staffIdMap: Record<string, string> = {
    "st-amara": amara.user.id,
    "st-nina": nina.user.id,
  };
  let seededShiftCount = 0;
  for (const shift of mockShifts) {
    const staffId = staffIdMap[shift.staffId];
    if (!staffId) continue;
    await prisma.staffShift.upsert({
      where: { id: shift.id },
      update: {},
      create: {
        id: shift.id,
        venueId: org.id,
        staffId,
        dayOfWeek: shift.dayOfWeek,
        startTime: shift.startTime,
        endTime: shift.endTime,
        zoneId: shift.zoneId,
      },
    });
    seededShiftCount += 1;
  }
  console.log(`${seededShiftCount} shifts seeded`);

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
