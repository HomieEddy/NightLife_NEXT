import { betterAuth } from "better-auth";
import { organization, admin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { getRawPrisma } from "@/features/shared/db";

export const auth = betterAuth({
  database: prismaAdapter(getRawPrisma(), { provider: "postgresql" }),
  secret: process.env.AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL,
  emailAndPassword: { enabled: true },
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
        },
      },
    }),
    admin(),
    nextCookies(),
  ],
});

export type Auth = typeof auth;
