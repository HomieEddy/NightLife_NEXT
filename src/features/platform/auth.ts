import { betterAuth } from "better-auth";
import { organization, admin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { getRawPrisma } from "@/features/shared/db";
import { logger } from "@/features/shared/logger";

export const auth = betterAuth({
  database: prismaAdapter(getRawPrisma(), { provider: "postgresql" }),
  secret: process.env.AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL,
  emailAndPassword: {
    enabled: true,
    // 5 sign-in attempts per 15 minutes per IP+email.
    // Better Auth's built-in rate limiter is per-IP; the per-email
    // dimension is added via the emailAndPassword plugin's own limiter.
    rateLimit: { limit: 5, period: 15 * 60 },
  },
  rateLimit: {
    window: 60,
    max: 30,
  },
  session: {
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  user: {
    additionalFields: {
      isPlatformAdmin: {
        type: "boolean",
        defaultValue: false,
        input: false,
      },
    },
  },
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          logger.info("auth:login", {
            userId: session.userId,
            sessionId: session.id,
          });
        },
      },
      delete: {
        after: async (session) => {
          logger.info("auth:logout", {
            userId: session.userId,
            sessionId: session.id,
          });
        },
      },
    },
  },
  hooks: {
    after: async (ctx) => {
      const url = (ctx as { request?: { url?: string } }).request?.url ?? "";
      const isSignIn =
        url.includes("/sign-in/email") || url.includes("/sign-in");
      if (!isSignIn) return;
      const authCtx = (ctx as { context?: { returned?: unknown } }).context;
      const returned = authCtx?.returned;
      if (
        returned &&
        typeof returned === "object" &&
        "error" in (returned as Record<string, unknown>)
      ) {
        const r = returned as Record<string, unknown>;
        logger.warn("auth:login-failure", {
          error: r.error,
          code: r.code,
        });
      }
    },
  },
  plugins: [
    organization({
      invitationExpiresIn: 60 * 60 * 48,
      organizationHooks: {
        afterAcceptInvitation: async ({ invitation, user }) => {
          const prisma = getRawPrisma();
          const draft = await prisma.invitation.findUnique({ where: { id: invitation.id } });
          if (!draft?.floorRole) throw new Error("Invitation profile is incomplete");
          const name = draft.draftName?.trim() || user.name;
          await prisma.$transaction([
            prisma.user.update({ where: { id: user.id }, data: { name } }),
            prisma.staffProfile.upsert({
              where: { userId: user.id },
              create: {
                userId: user.id,
                role: draft.floorRole,
                phone: draft.draftPhone ?? "",
                assignedZoneIds: draft.assignedZoneIds,
                avatarInitials: name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
              },
              update: {
                role: draft.floorRole,
                phone: draft.draftPhone ?? "",
                assignedZoneIds: draft.assignedZoneIds,
              },
            }),
          ]);
          logger.info("auth:invite-accepted", {
            userId: user.id,
            email: user.email,
            invitationId: invitation.id,
          });
        },
      },
    }),
    admin(),
    nextCookies(),
  ],
});

export type Auth = typeof auth;
