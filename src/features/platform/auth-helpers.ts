import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { SessionContext } from "@/features/shared/db";

/**
 * Better Auth's organization plugin only knows owner/admin/member — it has no
 * concept of our StaffRole (manager/host/bartender/runner/security). The org
 * creator gets "owner"; invite.ts maps manager → "admin", everyone else →
 * "member" (see staffRoleToOrgRole). So "manager area" access is owner|admin;
 * finer-grained staff roles aren't enforceable here until staff identity
 * itself moves off StaffProfile-as-mock (plans 03/07 note in staff-service).
 */
type OrgRole = "owner" | "admin" | "member";

const AREA_ROLES: Record<"manager" | "staff", OrgRole[]> = {
  manager: ["owner", "admin"],
  staff: ["owner", "admin", "member"],
};

async function getAuth() {
  const { auth } = await import("@/features/platform/auth");
  return auth;
}

export type AuthSession = {
  user: { id: string; name: string; email: string; banned?: boolean | null; isPlatformAdmin?: boolean };
  session: { id: string; activeOrganizationId?: string | null };
};

export async function getSession(): Promise<AuthSession | null> {
  const auth = await getAuth();
  return auth.api.getSession({ headers: await headers() }) as Promise<AuthSession | null>;
}

export async function requireSession(): Promise<AuthSession> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.banned) redirect("/login?error=suspended");
  return session;
}

async function memberRole(session: AuthSession): Promise<OrgRole | null> {
  const auth = await getAuth();
  const api = auth.api as Record<string, (...args: unknown[]) => unknown>;

  const org = session.session.activeOrganizationId
    ? await api.getFullOrganization({ headers: await headers() })
    : null;

  const member = (org as { members?: { userId: string; role: string }[] })
    ?.members?.find((m) => m.userId === session.user.id);

  return (member?.role as OrgRole) ?? null;
}

export async function requireRole(
  ...allowed: OrgRole[]
): Promise<AuthSession> {
  const session = await requireSession();
  const role = await memberRole(session);

  if (!role || !allowed.includes(role)) {
    redirect("/login?error=forbidden");
  }

  return session;
}

export async function requireArea(
  area: "manager" | "staff",
): Promise<AuthSession> {
  const allowed = AREA_ROLES[area];
  return requireRole(...allowed);
}

/**
 * Route-handler variant of requireArea — returns a 401/403 instead of
 * redirecting, since a redirect() inside a fetch-based API call would just
 * hand the client a redirected HTML response instead of JSON.
 */
export async function requireApiArea(
  area: "manager" | "staff",
): Promise<{ session: AuthSession } | { status: number; error: string }> {
  const session = await getSession();
  if (!session) return { status: 401, error: "Not authenticated" };
  if (session.user.banned) return { status: 403, error: "Account suspended" };

  const role = await memberRole(session);
  const allowed = AREA_ROLES[area];
  if (!role || !allowed.includes(role)) return { status: 403, error: "Forbidden" };

  return { session };
}

export async function requirePlatformAdmin(): Promise<AuthSession> {
  const session = await requireSession();
  if (!session.user.isPlatformAdmin) {
    redirect("/login?error=forbidden");
  }
  return session;
}

export async function requireApiPlatformAdmin(): Promise<
  { session: AuthSession } | { status: number; error: string }
> {
  const session = await getSession();
  if (!session) return { status: 401, error: "Not authenticated" };
  if (session.user.banned) return { status: 403, error: "Account suspended" };
  if (!session.user.isPlatformAdmin) return { status: 403, error: "Forbidden" };
  return { session };
}

export function sessionToDbContext(session: AuthSession): SessionContext {
  const orgId = session.session.activeOrganizationId;
  if (!orgId) throw new Error("No active organization");
  return { venueId: orgId };
}
