import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { SessionContext } from "./db";
import type { StaffRole } from "@/lib/types";

const AREA_ROLES: Record<string, StaffRole[]> = {
  manager: ["manager"],
  staff: ["manager", "host", "bartender", "runner", "security"],
};

async function getAuth() {
  const { auth } = await import("./auth");
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

async function memberRole(session: AuthSession): Promise<StaffRole | null> {
  const auth = await getAuth();
  const api = auth.api as Record<string, (...args: unknown[]) => unknown>;

  const org = session.session.activeOrganizationId
    ? await api.getFullOrganization({ headers: await headers() })
    : null;

  const member = (org as { members?: { userId: string; role: string }[] })
    ?.members?.find((m) => m.userId === session.user.id);

  return (member?.role as StaffRole) ?? null;
}

export async function requireRole(
  ...allowed: StaffRole[]
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

export function sessionToDbContext(session: AuthSession): SessionContext {
  const orgId = session.session.activeOrganizationId;
  if (!orgId) throw new Error("No active organization");
  return { venueId: orgId };
}
