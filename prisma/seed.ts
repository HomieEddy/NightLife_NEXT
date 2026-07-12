import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { betterAuth } from "better-auth";
import { organization, admin } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";

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
    plugins: [organization(), admin()],
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
  console.log(`\nDemo password for all users: ${DEMO_PASSWORD}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
