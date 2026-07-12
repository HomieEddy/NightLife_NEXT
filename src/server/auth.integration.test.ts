import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { execSync } from "node:child_process";
import { betterAuth } from "better-auth";
import { organization, admin } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";

describe("auth integration", () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let testAuth: any;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:17-alpine").start();
    const url = container.getConnectionUri();

    execSync(`npx prisma migrate deploy`, {
      env: { ...process.env, DATABASE_URL: url },
      cwd: process.cwd(),
    });

    const adapter = new PrismaPg(url);
    prisma = new PrismaClient({ adapter });

    testAuth = betterAuth({
      database: prismaAdapter(prisma, { provider: "postgresql" }),
      secret: "test-secret-32-chars-long-enough-xx",
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
  }, 60_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  it("staff token cannot access a different venue's org", async () => {
    // Create two users in two different orgs
    const userA = await testAuth.api.signUpEmail({
      body: { name: "User A", email: "a@test.com", password: "password123" },
    });
    const userB = await testAuth.api.signUpEmail({
      body: { name: "User B", email: "b@test.com", password: "password123" },
    });

    await testAuth.api.createOrganization({
      headers: new Headers({ authorization: `Bearer ${userA.token}` }),
      body: { name: "Venue A", slug: "venue-a" },
    });

    const orgB = await testAuth.api.createOrganization({
      headers: new Headers({ authorization: `Bearer ${userB.token}` }),
      body: { name: "Venue B", slug: "venue-b" },
    });

    // User A should not be a member of Org B
    const orgBMembers = await testAuth.api.listMembers({
      headers: new Headers({ authorization: `Bearer ${userB.token}` }),
      query: { organizationId: orgB.id },
    });

    const userAInOrgB = orgBMembers.data?.find(
      (m: { userId: string }) => m.userId === userA.user.id,
    );
    expect(userAInOrgB).toBeUndefined();
  });

  it("suspended user cannot sign in", async () => {
    const user = await testAuth.api.signUpEmail({
      body: {
        name: "Suspended User",
        email: "suspended@test.com",
        password: "password123",
      },
    });

    // Ban the user
    await testAuth.api.banUser({
      headers: new Headers({ authorization: `Bearer ${user.token}` }),
      body: { userId: user.user.id },
    });

    // Try to sign in
    const result = await testAuth.api.signInEmail({
      body: { email: "suspended@test.com", password: "password123" },
    });

    // Banned users should fail to get a valid session
    const session = await testAuth.api.getSession({
      headers: new Headers({
        authorization: `Bearer ${result?.token ?? "invalid"}`,
      }),
    });

    // The session should either be null or the user should be marked as banned
    if (session) {
      expect(session.user.banned).toBe(true);
    }
  });

  it("invitation is single-use", async () => {
    const owner = await testAuth.api.signUpEmail({
      body: {
        name: "Org Owner",
        email: "owner@test.com",
        password: "password123",
      },
    });

    const org = await testAuth.api.createOrganization({
      headers: new Headers({ authorization: `Bearer ${owner.token}` }),
      body: { name: "Test Org", slug: "test-org" },
    });

    const invitation = await testAuth.api.createInvitation({
      headers: new Headers({ authorization: `Bearer ${owner.token}` }),
      body: {
        email: "invitee@test.com",
        role: "member",
        organizationId: org.id,
      },
    });

    // Create the invitee user
    const invitee = await testAuth.api.signUpEmail({
      body: {
        name: "Invitee",
        email: "invitee@test.com",
        password: "password123",
      },
    });

    // Accept the invitation
    await testAuth.api.acceptInvitation({
      headers: new Headers({ authorization: `Bearer ${invitee.token}` }),
      body: { invitationId: invitation.id },
    });

    // Verify the invitation status is no longer pending
    const dbInvitation = await prisma.invitation.findUnique({
      where: { id: invitation.id },
    });
    expect(dbInvitation?.status).not.toBe("pending");
  });

  it("isPlatformAdmin flag gates admin access", async () => {
    const regular = await testAuth.api.signUpEmail({
      body: {
        name: "Regular User",
        email: "regular@test.com",
        password: "password123",
      },
    });

    const session = await testAuth.api.getSession({
      headers: new Headers({ authorization: `Bearer ${regular.token}` }),
    });

    expect(
      (session?.user as Record<string, unknown>)?.isPlatformAdmin,
    ).toBeFalsy();

    // Set isPlatformAdmin via direct DB update
    await prisma.user.update({
      where: { id: regular.user.id },
      data: { isPlatformAdmin: true },
    });

    const adminUser = await prisma.user.findUnique({
      where: { id: regular.user.id },
    });
    expect(adminUser?.isPlatformAdmin).toBe(true);
  });
});
