import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { betterAuth } from "better-auth";
import { organization, admin, bearer } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { mockVenue, mockZones, mockTables } from "../src/lib/mock-data/venue";
import { mockShifts } from "../src/lib/mock-data/staff";
import { getDb, getRawPrisma } from "../src/server/db";
import { ensureMapPositions } from "../src/server/venue-core";

const DEMO_PASSWORD = "demo1234";

async function main() {
  const adapter = new PrismaPg(process.env.DATABASE_URL!);
  const prisma = new PrismaClient({ adapter });

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
  const amara = await seedAuth.api.signUpEmail({
    body: {
      name: "Amara Diallo",
      email: "amara@velvetmtl.club",
      password: DEMO_PASSWORD,
    },
  });
  console.log(`User: Amara Diallo (${amara.user.id})`);

  const nina = await seedAuth.api.signUpEmail({
    body: {
      name: "Nina Kovač",
      email: "nina@velvetmtl.club",
      password: DEMO_PASSWORD,
    },
  });
  console.log(`User: Nina Kovač (${nina.user.id})`);

  const adminUser = await seedAuth.api.signUpEmail({
    body: {
      name: "Platform Admin",
      email: "admin@nightlifext.com",
      password: DEMO_PASSWORD,
    },
  });
  await prisma.user.update({
    where: { id: adminUser.user.id },
    data: { isPlatformAdmin: true, role: "admin" },
  });
  console.log(`User: Platform Admin (${adminUser.user.id}) [isPlatformAdmin]`);

  // ── Organization (= venue) ────────────────────────────────────────
  const org = await seedAuth.api.createOrganization({
    headers: new Headers({ authorization: `Bearer ${amara.token}` }),
    body: {
      name: "Velvet Montréal",
      slug: "velvet-mtl",
    },
  });
  console.log(`Organization: Velvet Montréal (${org.id})`);

  // Add Nina as member
  await seedAuth.api.addMember({
    headers: new Headers({ authorization: `Bearer ${amara.token}` }),
    body: {
      userId: nina.user.id,
      organizationId: org.id,
      role: "member",
    },
  });
  console.log(`Member: Nina added to Velvet Montréal`);

  // ── Staff profiles ────────────────────────────────────────────────
  await prisma.staffProfile.upsert({
    where: { userId: amara.user.id },
    update: {},
    create: {
      userId: amara.user.id,
      phone: "+33 6 12 34 56 78",
      avatarInitials: "AD",
      assignedZoneIds: [],
      isOnShift: true,
    },
  });

  await prisma.staffProfile.upsert({
    where: { userId: nina.user.id },
    update: {},
    create: {
      userId: nina.user.id,
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

  // ── Shifts (staffId references the demo roster, not real accounts yet) ──
  const staffIdMap: Record<string, string> = {
    "st-amara": amara.user.id,
    "st-nina": nina.user.id,
  };
  for (const shift of mockShifts) {
    await prisma.staffShift.upsert({
      where: { id: shift.id },
      update: {},
      create: {
        id: shift.id,
        venueId: org.id,
        staffId: staffIdMap[shift.staffId] ?? shift.staffId,
        dayOfWeek: shift.dayOfWeek,
        startTime: shift.startTime,
        endTime: shift.endTime,
        zoneId: shift.zoneId,
      },
    });
  }
  console.log(`${mockShifts.length} shifts seeded`);

  console.log(`\nDemo password for all users: ${DEMO_PASSWORD}`);

  await prisma.$disconnect();
  await getRawPrisma().$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
