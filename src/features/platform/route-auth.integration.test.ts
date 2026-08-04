import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import type { PrismaClient } from "@prisma/client";
import type { StaffRole } from "@/lib/types";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";
import { _resetEnvCache } from "@/features/shared/env";

/**
 * Real-session route auth: drives actual route handlers with real Better Auth
 * sessions against PGlite. Sessions are created directly in the DB (user +
 * session token + org membership + staff profile); the session-token cookie is
 * HMAC-signed with better-auth's own crypto (the same scheme setSessionCookie
 * uses), so `auth.api.getSession` resolves them for real. The ONLY mock is
 * next/headers — the request-context cookie carrier — which is what makes
 * requireApiArea's `headers()` callable outside a real HTTP request. The
 * session lookup, org-membership resolution, and every 401/403 decision run
 * for real.
 */

const globalHeaders = vi.hoisted(() => new Headers());

vi.mock("next/headers", () => ({
  headers: () => globalHeaders,
}));

const SESSION_COOKIE = "better-auth.session_token";

// Route modules — live handlers are what the exported POST is in live mode.
const MANAGER_ROUTE = "@/app/api/workforce/tips/rule/route";
const STAFF_ROUTE = "@/app/api/workforce/time/clock-in/route";
const ADMIN_ROUTE = "@/app/api/platform/leads/route";

describe("route auth boundaries — real sessions (integration)", () => {
  let testDb: TestDb;
  let raw: PrismaClient;
  let orgId = "";

  beforeAll(async () => {
    testDb = await createTestDb();
    raw = testDb.rawClient;
    // createTestDb installs AUTH_SECRET itself — that is the secret the app
    // auth instance signs cookies with; sign with the same value.

    await raw.organization.create({ data: { id: "org-routes", name: "Route Venue", slug: "route-venue" } });
    await raw.venue.create({
      data: {
        id: "org-routes", address: "1 Test St", city: "Testville", timezone: "UTC", currency: "CAD",
        openingHours: [], serviceFees: [], floorMap: { width: 16, height: 9 }, autoApproveGuests: false,
        logoInitials: "RT", slaThresholds: { orderWarnMinutes: 6, orderCriticalMinutes: 12, helpWarnMinutes: 4, helpCriticalMinutes: 8 },
        lastCallAutoFlagTables: true,
      },
    });
    await raw.tenant.create({ data: { id: "org-routes", name: "Route Venue", slug: "t-route-venue", plan: "starter", status: "active" } });
    orgId = "org-routes";
  }, 60_000);

  afterAll(async () => {
    await testDb?.teardown();
  });

/** Signs a session token the way Better Auth's setSignedCookie does: HMAC-SHA256
 *  over the token with the auth secret, standard padded base64 (44 chars). */
async function signSessionToken(token: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(token));
  return `${token}.${Buffer.from(sig).toString("base64")}`;
}

/** Directly creates a user + session (+ org membership + staff profile). Returns the signed cookie value. */
async function makeUser(
  id: string,
    opts: { orgRole?: "owner" | "admin" | "member"; floorRole?: StaffRole; isPlatformAdmin?: boolean; banned?: boolean } = {},
): Promise<string> {
  await raw.user.create({
    data: {
      id, name: id, email: `${id}@test.local`, emailVerified: true,
      isPlatformAdmin: opts.isPlatformAdmin ?? false,
      banned: opts.banned ?? null,
    },
  });
  const token = `token-${id}`;
  await raw.session.create({
    data: { id: `sess-${id}`, token, userId: id, expiresAt: new Date(Date.now() + 86_400_000) },
  });
  if (opts.orgRole) {
    await raw.member.create({ data: { id: `m-${id}`, userId: id, organizationId: orgId, role: opts.orgRole } });
    await raw.session.update({ where: { id: `sess-${id}` }, data: { activeOrganizationId: orgId } });
    await raw.staffProfile.create({
      data: { userId: id, role: opts.floorRole ?? "runner", phone: "555", avatarInitials: "XX" },
    });
  }
  // Better Auth signs the session-token cookie (token.signature) — an
  // unsigned token reads as no session.
  const signed = await signSessionToken(token, process.env.AUTH_SECRET!);
  return `${SESSION_COOKIE}=${signed}`;
}

  async function callPost(route: string, body: unknown, cookie: string): Promise<Response> {
    globalHeaders.set("cookie", cookie);
    const mod = await import(route);
    return mod.POST(new NextRequest(`http://localhost${route.replace(/^@\/app/, "")}`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(body),
    }));
  }

  it("401s manager routes with no session at all", async () => {
    const res = await callPost(MANAGER_ROUTE, {}, "");
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Not authenticated");
  });

  it("403s a staff member hitting a manager-gated route", async () => {
    const cookie = await makeUser("member-403", { orgRole: "member", floorRole: "runner" });
    const res = await callPost(MANAGER_ROUTE, {}, cookie);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Forbidden");
  });

  it("403s a suspended account on any area", async () => {
    const cookie = await makeUser("banned-user", { orgRole: "member", banned: true });
    const res = await callPost(MANAGER_ROUTE, {}, cookie);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Account suspended");
  });

  it("lets an owner complete a manager route end-to-end (real 200 through the DB)", async () => {
    const cookie = await makeUser("owner-ok", { orgRole: "owner", floorRole: "manager" });
    const res = await callPost(MANAGER_ROUTE, {
      id: "rule-1", venueId: orgId, name: "Hours", basis: "equal",
      includeRoles: ["runner"], houseRetentionPct: 0, active: true,
    }, cookie);
    expect(res.status).toBe(200);
    const row = await raw.tipPoolRule.findUnique({ where: { id: "rule-1" } });
    expect(row?.venueId).toBe(orgId);
  });

  it("403s a staff member whose role lacks the action at the route level", async () => {
    const cookie = await makeUser("runner-action", { orgRole: "member", floorRole: "runner" });
    // cashout:close is bartender+ only — the runner holds no such action.
    const res = await callPost("@/app/api/cashout/route", {}, cookie);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/Role runner cannot/i);
  });

  it("lets a staff member through a staff-area route with a valid action (body validation, not auth, rejects)", async () => {
    const cookie = await makeUser("staff-ok", { orgRole: "member", floorRole: "bartender" });
    const res = await callPost(STAFF_ROUTE, {}, cookie);
    // The bartender has time:clock-self — the empty body fails zod, not the gate.
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
    expect(res.status).toBe(400);
  });

  it("time/edit: 403s a runner editing another staff member's entry, 201s a manager", async () => {
    const target = await makeUser("entry-owner", { orgRole: "member", floorRole: "runner" });
    await raw.timeEntry.create({
      data: {
        id: "entry-1", venueId: orgId, staffId: "entry-owner", shiftId: null,
        clockInAt: new Date(), breaks: [], source: "self",
      },
    });
    const runner = await makeUser("edit-runner", { orgRole: "member", floorRole: "runner" });
    const manager = await makeUser("edit-manager", { orgRole: "owner", floorRole: "manager" });

    const denied = await callPost("@/app/api/workforce/time/edit/route", {
      entryId: "entry-1", clockInAt: "2026-08-04T00:00:00Z", editorId: "edit-runner", reason: "fix",
    }, runner);
    expect(denied.status).toBe(403);
    expect((await denied.json()).error).toMatch(/cannot correct/i);

    const allowed = await callPost("@/app/api/workforce/time/edit/route", {
      entryId: "entry-1", clockInAt: "2026-08-04T00:00:00Z", editorId: "edit-manager", reason: "fix",
    }, manager);
    expect(allowed.status).toBe(201);
    // The correction row supersedes the original; the original is untouched.
    const correction = await raw.timeEntry.findFirst({ where: { supersedesId: "entry-1" } });
    expect(correction?.staffId).toBe("entry-owner");
    void target;
  });

  it("403s non-platform-admins on admin routes and admits the platform admin", async () => {
    const tenantCookie = await makeUser("tenant-user", { orgRole: "owner" });
    const denied = await callPost(ADMIN_ROUTE, {}, tenantCookie);
    expect(denied.status).toBe(403);

    const adminCookie = await makeUser("padmin", { isPlatformAdmin: true });
    const allowed = await callPost(ADMIN_ROUTE, {}, adminCookie);
    expect(allowed.status).not.toBe(401);
    expect(allowed.status).not.toBe(403);
  });
});
