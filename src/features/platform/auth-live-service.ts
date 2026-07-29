"use client";

import type { AuthUser, SignInInput } from "@/lib/types";
import { authClient } from "@/lib/auth-client";

/** Org roles are owner/admin/member — owner|admin run the venue, member is floor staff. */
export function orgRoleToAppRole(memberRole: string | null | undefined, isPlatformAdmin: boolean): AuthUser["role"] {
  if (isPlatformAdmin) return "admin";
  return memberRole === "member" ? "staff" : "manager";
}

function sessionToAuthUser(session: {
  user: { id: string; name: string; email: string; isPlatformAdmin?: boolean };
  session: { activeOrganizationId?: string | null };
}, memberRole?: string | null): AuthUser {
  const isPlatformAdmin = (session.user as Record<string, unknown>).isPlatformAdmin === true;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: orgRoleToAppRole(memberRole, isPlatformAdmin),
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

    // Better Auth doesn't auto-activate an organization on sign-in — every
    // venue-scoped read (getDb's session.venueId) needs activeOrganizationId set.
    const { data: orgs } = await authClient.organization.list();
    if (orgs && orgs.length > 0) {
      await authClient.organization.setActive({ organizationId: orgs[0].id });
    }

    const session = await authClient.getSession();
    if (!session.data) return null;

    const { data: member } = await authClient.organization.getActiveMember();
    return sessionToAuthUser(session.data, member?.role);
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
