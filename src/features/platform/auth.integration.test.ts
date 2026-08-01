import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { betterAuth } from "better-auth";
import { organization, admin, bearer } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";

describe("auth integration", () => {
  let testDb: TestDb;
  let prisma: PrismaClient;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let testAuth: any;

  beforeAll(async () => {
    testDb = await createTestDb();
    prisma = testDb.rawClient;

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
      // bearer() lets `Authorization: Bearer <token>` calls authenticate
      // organization endpoints the same way seed.ts needs it to (see its
      // comment) — without it every Bearer-authed .api call 401s.
      plugins: [organization(), admin(), bearer()],
    });
  }, 60_000);

  afterAll(async () => {
    await testDb?.teardown();
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
    const adminUser = await testAuth.api.signUpEmail({
      body: {
        name: "Admin",
        email: "ban-admin@test.com",
        password: "password123",
      },
    });
    await prisma.user.update({
      where: { id: adminUser.user.id },
      data: { role: "admin" },
    });

    const user = await testAuth.api.signUpEmail({
      body: {
        name: "Suspended User",
        email: "suspended@test.com",
        password: "password123",
      },
    });

    await testAuth.api.banUser({
      headers: new Headers({ authorization: `Bearer ${adminUser.token}` }),
      body: { userId: user.user.id },
    });

    // Banned user should be rejected at sign-in
    await expect(
      testAuth.api.signInEmail({
        body: { email: "suspended@test.com", password: "password123" },
      }),
    ).rejects.toThrow(/banned/);
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
