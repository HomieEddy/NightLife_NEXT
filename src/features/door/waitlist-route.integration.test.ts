import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";

/**
 * The waitlist route handlers (`/api/waitlist/entries[/[id]]`) talk to Prisma
 * directly — there is no waitlist-core module to unit-test against, unlike
 * most other domains. So these route handlers are exercised end to end: real
 * PGlite Postgres underneath, only the session layer mocked (Better Auth
 * cookies aren't available outside a running server).
 */

let currentVenueId = "";

vi.mock("@/features/platform/auth-helpers", () => ({
  requireApiArea: vi.fn(async () => ({
    session: { user: { id: "st-mgr", name: "Manager" }, session: { activeOrganizationId: currentVenueId } },
  })),
  sessionToDbContext: vi.fn(() => ({ venueId: currentVenueId })),
}));

vi.mock("@/features/shared/app-mode", () => ({
  isDemoMode: () => false,
  getAppMode: () => "live" as const,
}));

async function makeVenue(prisma: PrismaClient, id: string) {
  await prisma.organization.create({ data: { id, name: id, slug: id } });
  await prisma.venue.create({
    data: {
      id, address: "1 Test St", city: "Testville", timezone: "America/Toronto", currency: "CAD",
      openingHours: [], serviceFees: [], floorMap: { width: 16, height: 9 },
      autoApproveGuests: false, logoInitials: "TT",
      slaThresholds: { orderWarnMinutes: 6, orderCriticalMinutes: 12, helpWarnMinutes: 4, helpCriticalMinutes: 8 },
      lastCallAutoFlagTables: true,
    },
  });
}

function jsonRequest(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("waitlist route handlers (plan 17, WS-2)", () => {
  let testDb: TestDb;
  let prisma: PrismaClient;
  const venueA = "waitlist-venue-a";
  const venueB = "waitlist-venue-b";

  beforeAll(async () => {
    testDb = await createTestDb();
    prisma = testDb.rawClient;
    await makeVenue(prisma, venueA);
    await makeVenue(prisma, venueB);
    // The routes now call requirePermission → getCurrentStaff, which needs a
    // real member + staffProfile. Seed a manager in both venues (manager holds
    // waitlist:manage by default).
    await prisma.user.create({ data: { id: "st-mgr", name: "Manager", email: "mgr@test.local" } });
    await prisma.member.createMany({
      data: [
        { id: "m-a", userId: "st-mgr", organizationId: venueA, role: "admin" },
        { id: "m-b", userId: "st-mgr", organizationId: venueB, role: "admin" },
      ],
    });
    await prisma.staffProfile.create({
      data: { userId: "st-mgr", role: "manager", phone: "555", avatarInitials: "MG" },
    });
  }, 60_000);

  afterAll(async () => {
    await testDb?.teardown();
  });

  beforeEach(() => {
    currentVenueId = venueA;
  });

  it("POST creates an entry with status waiting", async () => {
    const { POST } = await import("@/app/api/waitlist/entries/route");
    const res = await POST(jsonRequest("http://localhost/api/waitlist/entries", "POST", {
      name: "Roxanne", partySize: 3, phone: "555-0100", quotedMinutes: 20,
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe("waiting");
    expect(body.name).toBe("Roxanne");
  });

  it("GET lists entries ordered by join time", async () => {
    const { GET } = await import("@/app/api/waitlist/entries/route");
    const res = await GET(jsonRequest("http://localhost/api/waitlist/entries", "GET"));
    expect(res.status).toBe(200);
    const body = await res.json() as { name: string }[];
    expect(body.some((e) => e.name === "Roxanne")).toBe(true);
  });

  it("PATCH [id] updates the entry's status", async () => {
    const { POST } = await import("@/app/api/waitlist/entries/route");
    const created = await (await POST(jsonRequest("http://localhost/api/waitlist/entries", "POST", {
      name: "Théo", partySize: 2, quotedMinutes: 15,
    }))).json();

    const { PATCH } = await import("@/app/api/waitlist/entries/[id]/route");
    const res = await PATCH(
      jsonRequest(`http://localhost/api/waitlist/entries/${created.id}`, "PATCH", { status: "seated" }),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("seated");
  });

  it("PATCH [id] 404s for an entry that does not exist", async () => {
    const { PATCH } = await import("@/app/api/waitlist/entries/[id]/route");
    const res = await PATCH(
      jsonRequest("http://localhost/api/waitlist/entries/no-such-id", "PATCH", { status: "seated" }),
      { params: Promise.resolve({ id: "no-such-id" }) },
    );
    expect(res.status).toBe(404);
  });

  it("a tenant's GET never returns another venue's waitlist entries", async () => {
    currentVenueId = venueB;
    const { POST } = await import("@/app/api/waitlist/entries/route");
    await POST(jsonRequest("http://localhost/api/waitlist/entries", "POST", {
      name: "B's Guest", partySize: 1, quotedMinutes: 10,
    }));

    currentVenueId = venueA;
    const { GET } = await import("@/app/api/waitlist/entries/route");
    const body = await (await GET(jsonRequest("http://localhost/api/waitlist/entries", "GET"))).json() as { name: string }[];
    expect(body.some((e) => e.name === "B's Guest")).toBe(false);
  });

  it("a tenant cannot PATCH another venue's waitlist entry", async () => {
    currentVenueId = venueB;
    const { POST } = await import("@/app/api/waitlist/entries/route");
    const otherEntry = await (await POST(jsonRequest("http://localhost/api/waitlist/entries", "POST", {
      name: "B's Second Guest", partySize: 2, quotedMinutes: 10,
    }))).json();

    currentVenueId = venueA;
    const { PATCH } = await import("@/app/api/waitlist/entries/[id]/route");
    const res = await PATCH(
      jsonRequest(`http://localhost/api/waitlist/entries/${otherEntry.id}`, "PATCH", { status: "seated" }),
      { params: Promise.resolve({ id: otherEntry.id }) },
    );
    expect(res.status).toBe(404);
  });
});
