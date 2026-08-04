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
    // 5 sign-in attempts per 15 minutes per email address.
    // Better Auth's built-in email/password limiter is keyed by email, not
    // IP — a failed-guess flood can lock a known account for the window.
    rateLimit: { limit: 5, period: 15 * 60 },
  },
  rateLimit: {
    window: 60,
    max: 30,
  },
  session: {
    cookieCache: { enabled: true, maxAge: 60 * 5 },
    // Staff sessions last a work week — long enough to survive a long night
    // and re-login-free operations, short enough that a leaked cookie rots.
    expiresIn: 60 * 60 * 24 * 7,
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
  onAPIError: {
    // A failed sign-in throws an APIError and never reaches the `after`
    // hook's `returned` — this is the only seam that sees it.
    onError: (error, ctx) => {
      const url = (ctx as { request?: { url?: string } }).request?.url ?? "";
      if (!url.includes("/sign-in")) return;
      const e = error as { status?: number; statusCode?: number; code?: string; message?: string };
      logger.warn("auth:login-failure", {
        status: e.status ?? e.statusCode,
        code: e.code,
        message: e.message,
      });
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
            // consentAt: the accept form requires the privacy-policy checkbox
            // before it calls acceptInvitation — reaching this hook means the
            // consent was given (Law 25 evidence).
            prisma.user.update({ where: { id: user.id }, data: { name, consentAt: new Date() } }),
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
