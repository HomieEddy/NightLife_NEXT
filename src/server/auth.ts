import { betterAuth } from "better-auth";
import { organization, admin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { getRawPrisma } from "./db";

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
    }),
    admin(),
    nextCookies(),
  ],
});

export type Auth = typeof auth;
