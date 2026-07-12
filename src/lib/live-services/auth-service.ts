"use client";

import type { AuthUser, SignInInput } from "@/lib/types";
import { authClient } from "@/lib/auth-client";

function sessionToAuthUser(session: {
  user: { id: string; name: string; email: string; isPlatformAdmin?: boolean };
  session: { activeOrganizationId?: string | null };
}, memberRole?: string): AuthUser {
  const isPlatformAdmin = (session.user as Record<string, unknown>).isPlatformAdmin === true;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: memberRole === "manager" ? "manager" : isPlatformAdmin ? "admin" : "staff",
    venueId: session.session.activeOrganizationId ?? undefined,
  };
}

export const liveAuthService = {
  async signIn(input: SignInInput): Promise<AuthUser | null> {
    const { data, error } = await authClient.signIn.email({
      email: input.email.trim().toLowerCase(),
      password: input.pin,
    });
    if (error || !data) return null;

    const session = await authClient.getSession();
    if (!session.data) return null;

    return sessionToAuthUser(session.data);
  },

  signOut(): void {
    authClient.signOut();
  },

  getCurrentUser(): AuthUser | null {
    return null;
  },

  async listPersonas(): Promise<AuthUser[]> {
    return [];
  },
};
