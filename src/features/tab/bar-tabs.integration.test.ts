import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";

/**
 * Bar tab route handlers (`/api/bar-tabs[/[id]/close]`) talk to Prisma
 * directly — there is no bar-tab core module, unlike most other domains. So
 * these are exercised end to end: real PGlite Postgres, only the session
 * layer mocked (Better Auth cookies aren't available outside a running server).
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

describe("bar tab route handlers (plan 16, WS-1)", () => {
  let testDb: TestDb;
  let prisma: PrismaClient;
  const venueA = "bartab-venue-a";
  const venueB = "bartab-venue-b";

  beforeAll(async () => {
    testDb = await createTestDb();
    prisma = testDb.rawClient;
    await makeVenue(prisma, venueA);
    await makeVenue(prisma, venueB);
    // The close route now calls requirePermission → getCurrentStaff, which needs
    // a real member + staffProfile. Seed a manager in both venues (manager holds
    // tab:close-bar by default).
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

  it("POST opens a bar tab", async () => {
    const { POST } = await import("@/app/api/bar-tabs/route");
    const res = await POST(jsonRequest("http://localhost/api/bar-tabs", "POST", {
      guestName: "Chloé", staffId: "st-1", staffName: "Sofia",
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe("open");
    expect(body.guestName).toBe("Chloé");
  });

  it("POST rejects a payload missing required fields", async () => {
    const { POST } = await import("@/app/api/bar-tabs/route");
    const res = await POST(jsonRequest("http://localhost/api/bar-tabs", "POST", { guestName: "" }));
    expect(res.status).toBe(400);
  });

  it("GET lists tabs, optionally filtered by status", async () => {
    const { GET } = await import("@/app/api/bar-tabs/route");
    const all = await (await GET(jsonRequest("http://localhost/api/bar-tabs", "GET"))).json() as { status: string }[];
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((t) => t.status === "open")).toBe(true);

    const closedOnly = await (await GET(jsonRequest("http://localhost/api/bar-tabs?status=closed", "GET"))).json() as unknown[];
    expect(closedOnly.length).toBe(0);
  });

  it("closing an open tab flips status and stamps closedAt", async () => {
    const { POST } = await import("@/app/api/bar-tabs/route");
    const opened = await (await POST(jsonRequest("http://localhost/api/bar-tabs", "POST", {
      guestName: "Emma", staffId: "st-2", staffName: "Theo",
    }))).json();

    const { POST: close } = await import("@/app/api/bar-tabs/[id]/close/route");
    const res = await close(
      jsonRequest(`http://localhost/api/bar-tabs/${opened.id}/close`, "POST"),
      { params: Promise.resolve({ id: opened.id }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("closed");
    expect(body.closedAt).toBeTruthy();
  });

  it("refuses to close a tab that is already closed", async () => {
    const { POST } = await import("@/app/api/bar-tabs/route");
    const opened = await (await POST(jsonRequest("http://localhost/api/bar-tabs", "POST", {
      guestName: "Karim", staffId: "st-3", staffName: "Maya",
    }))).json();

    const { POST: close } = await import("@/app/api/bar-tabs/[id]/close/route");
    await close(jsonRequest(`http://localhost/api/bar-tabs/${opened.id}/close`, "POST"), {
      params: Promise.resolve({ id: opened.id }),
    });
    const secondClose = await close(jsonRequest(`http://localhost/api/bar-tabs/${opened.id}/close`, "POST"), {
      params: Promise.resolve({ id: opened.id }),
    });
    expect(secondClose.status).toBe(409);
  });

  it("closing a tab that does not exist 404s", async () => {
    const { POST: close } = await import("@/app/api/bar-tabs/[id]/close/route");
    const res = await close(jsonRequest("http://localhost/api/bar-tabs/no-such-id/close", "POST"), {
      params: Promise.resolve({ id: "no-such-id" }),
    });
    expect(res.status).toBe(404);
  });

  it("a tenant's GET never returns another venue's bar tabs", async () => {
    currentVenueId = venueB;
    const { POST } = await import("@/app/api/bar-tabs/route");
    await POST(jsonRequest("http://localhost/api/bar-tabs", "POST", {
      guestName: "B's Guest", staffId: "st-b", staffName: "St B",
    }));

    currentVenueId = venueA;
    const { GET } = await import("@/app/api/bar-tabs/route");
    const body = await (await GET(jsonRequest("http://localhost/api/bar-tabs", "GET"))).json() as { guestName: string }[];
    expect(body.some((t) => t.guestName === "B's Guest")).toBe(false);
  });

  it("a tenant cannot close another venue's bar tab", async () => {
    currentVenueId = venueB;
    const { POST } = await import("@/app/api/bar-tabs/route");
    const otherTab = await (await POST(jsonRequest("http://localhost/api/bar-tabs", "POST", {
      guestName: "B's Second Guest", staffId: "st-b2", staffName: "St B2",
    }))).json();

    currentVenueId = venueA;
    const { POST: close } = await import("@/app/api/bar-tabs/[id]/close/route");
    const res = await close(
      jsonRequest(`http://localhost/api/bar-tabs/${otherTab.id}/close`, "POST"),
      { params: Promise.resolve({ id: otherTab.id }) },
    );
    expect(res.status).toBe(404);
  });
});
