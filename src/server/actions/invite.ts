"use server";

import { headers } from "next/headers";
import type { StaffRole } from "@/lib/types";

type OrgRole = "member" | "admin" | "owner";

function staffRoleToOrgRole(role: StaffRole): OrgRole {
  return role === "manager" ? "admin" : "member";
}

interface InviteInput {
  email: string;
  name: string;
  role: StaffRole;
  organizationId: string;
}

interface InvitationApi {
  createInvitation(input: {
    headers: Headers;
    body: {
      email: string;
      role: OrgRole;
      organizationId: string;
    };
  }): Promise<unknown>;
}

async function getAuth() {
  const { auth } = await import("@/features/platform/auth");
  return auth;
}

export async function inviteStaffMember(input: InviteInput) {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Not authenticated" };

  const s = session.session as Record<string, unknown>;
  const orgId = input.organizationId || (s.activeOrganizationId as string);
  if (!orgId) return { error: "No active organization" };

  try {
    const api = auth.api as unknown as InvitationApi;
    const invitation = await api.createInvitation({
      headers: await headers(),
      body: {
        email: input.email.trim().toLowerCase(),
        role: staffRoleToOrgRole(input.role),
        organizationId: orgId,
      },
    });
    return { data: invitation };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Invite failed" };
  }
}

export async function resendStaffInvite(input: {
  email: string;
  organizationId: string;
}) {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Not authenticated" };

  const s = session.session as Record<string, unknown>;
  const orgId = input.organizationId || (s.activeOrganizationId as string);
  if (!orgId) return { error: "No active organization" };

  try {
    const api = auth.api as unknown as InvitationApi;
    const invitation = await api.createInvitation({
      headers: await headers(),
      body: {
        email: input.email.trim().toLowerCase(),
        role: "member" as const,
        organizationId: orgId,
      },
    });
    return { data: invitation };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Resend failed" };
  }
}
