import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";

/**
 * Pulse attention ack/snooze (`/api/floor/attention[/[id]/{ack,snooze}]`) —
 * named explicitly in WS-2's scope. Talks to Prisma directly, no core module.
 * Real PGlite Postgres, session layer mocked (no running server for cookies).
 *
 * This is also the regression test for a missing-migration bug: AttentionItem
 * and AttentionAcknowledgment were added to schema.prisma but no migration
 * ever created their tables, so every one of these routes failed with "table
 * does not exist" against a real deployment. Found while closing F-06.
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

describe("pulse attention route handlers (plan 17, WS-2)", () => {
  let testDb: TestDb;
  let prisma: PrismaClient;
  const venueA = "attn-venue-a";
  const venueB = "attn-venue-b";

  beforeAll(async () => {
    testDb = await createTestDb();
    prisma = testDb.rawClient;
    await makeVenue(prisma, venueA);
    await makeVenue(prisma, venueB);
  }, 60_000);

  afterAll(async () => {
    await testDb?.teardown();
  });

  beforeEach(() => {
    currentVenueId = venueA;
  });

  it("POST creates an attention item", async () => {
    const { POST } = await import("@/app/api/floor/attention/route");
    const res = await POST(jsonRequest("http://localhost/api/floor/attention", "POST", {
      type: "sla-breach", severity: "warn", tableId: "t-1", tableCode: "VIP-01",
      zoneName: "VIP", message: "Order overdue 8 minutes",
    }));
    expect(res.status).toBe(201);
    expect((await res.json()).resolved).toBe(false);
  });

  it("GET returns items with their acknowledgments joined", async () => {
    const { GET } = await import("@/app/api/floor/attention/route");
    const res = await GET(jsonRequest("http://localhost/api/floor/attention", "GET"));
    expect(res.status).toBe(200);
    const body = await res.json() as { items: unknown[]; acknowledgments: unknown[] };
    expect(body.items.length).toBeGreaterThan(0);
  });

  it("acking an item creates an acknowledgment row", async () => {
    const { POST } = await import("@/app/api/floor/attention/route");
    const item = await (await POST(jsonRequest("http://localhost/api/floor/attention", "POST", {
      type: "sla-breach", severity: "warn", tableId: "t-2", tableCode: "VIP-02",
      zoneName: "VIP", message: "Help request overdue",
    }))).json();

    const { POST: ack } = await import("@/app/api/floor/attention/[id]/ack/route");
    const res = await ack(
      jsonRequest(`http://localhost/api/floor/attention/${item.id}/ack`, "POST", {
        staffId: "st-1", staffName: "Sofia",
      }),
      { params: Promise.resolve({ id: item.id }) },
    );
    expect(res.status).toBe(201);
    expect((await res.json()).snoozedUntil).toBeFalsy();
  });

  it("snoozing an item stamps snoozedUntil", async () => {
    const { POST } = await import("@/app/api/floor/attention/route");
    const item = await (await POST(jsonRequest("http://localhost/api/floor/attention", "POST", {
      type: "sla-breach", severity: "critical", tableId: "t-3", tableCode: "VIP-03",
      zoneName: "VIP", message: "Order critically overdue",
    }))).json();

    const { POST: snooze } = await import("@/app/api/floor/attention/[id]/snooze/route");
    const snoozeUntil = new Date(Date.now() + 5 * 60_000).toISOString();
    const res = await snooze(
      jsonRequest(`http://localhost/api/floor/attention/${item.id}/snooze`, "POST", {
        staffId: "st-1", staffName: "Sofia", snoozedUntil: snoozeUntil,
      }),
      { params: Promise.resolve({ id: item.id }) },
    );
    expect(res.status).toBe(201);
    expect((await res.json()).snoozedUntil).toBeTruthy();
  });

  it("acking an item that does not exist 404s", async () => {
    const { POST: ack } = await import("@/app/api/floor/attention/[id]/ack/route");
    const res = await ack(
      jsonRequest("http://localhost/api/floor/attention/no-such-id/ack", "POST", {
        staffId: "st-1", staffName: "Sofia",
      }),
      { params: Promise.resolve({ id: "no-such-id" }) },
    );
    expect(res.status).toBe(404);
  });

  it("a tenant cannot acknowledge another venue's attention item", async () => {
    currentVenueId = venueB;
    const { POST } = await import("@/app/api/floor/attention/route");
    const otherItem = await (await POST(jsonRequest("http://localhost/api/floor/attention", "POST", {
      type: "sla-breach", severity: "warn", tableId: "t-b", tableCode: "B-01",
      zoneName: "Main", message: "B's item",
    }))).json();

    currentVenueId = venueA;
    const { POST: ack } = await import("@/app/api/floor/attention/[id]/ack/route");
    const res = await ack(
      jsonRequest(`http://localhost/api/floor/attention/${otherItem.id}/ack`, "POST", {
        staffId: "st-a", staffName: "Amara",
      }),
      { params: Promise.resolve({ id: otherItem.id }) },
    );
    expect(res.status).toBe(404);
  });
});

describe("VIP tier benefit route handlers (plan 17, CRM-12)", () => {
  let testDb: TestDb;
  let prisma: PrismaClient;
  const venueA = "vip-venue-a";
  const venueB = "vip-venue-b";

  beforeAll(async () => {
    testDb = await createTestDb();
    prisma = testDb.rawClient;
    await makeVenue(prisma, venueA);
    await makeVenue(prisma, venueB);
  }, 60_000);

  afterAll(async () => {
    await testDb?.teardown();
  });

  beforeEach(() => {
    currentVenueId = venueA;
  });

  it("creates a benefit and lists it filtered by tier", async () => {
    const { POST } = await import("@/app/api/guests/vip-tiers/route");
    await POST(jsonRequest("http://localhost/api/guests/vip-tiers", "POST", {
      tier: "vip", benefit: "Priority host", category: "service",
    }));

    const { GET } = await import("@/app/api/guests/vip-tiers/route");
    const list = await (await GET(jsonRequest("http://localhost/api/guests/vip-tiers?tier=vip", "GET"))).json() as { tier: string }[];
    expect(list.length).toBe(1);
    expect(list[0].tier).toBe("vip");
  });

  it("updates and deletes a benefit", async () => {
    const { POST } = await import("@/app/api/guests/vip-tiers/route");
    const created = await (await POST(jsonRequest("http://localhost/api/guests/vip-tiers", "POST", {
      tier: "regular", benefit: "Birthday shoutout", category: "service",
    }))).json();

    const { PATCH } = await import("@/app/api/guests/vip-tiers/[id]/route");
    const updated = await PATCH(
      jsonRequest(`http://localhost/api/guests/vip-tiers/${created.id}`, "PATCH", { active: false }),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect((await updated.json()).active).toBe(false);

    const { DELETE } = await import("@/app/api/guests/vip-tiers/[id]/route");
    const deleted = await DELETE(
      jsonRequest(`http://localhost/api/guests/vip-tiers/${created.id}`, "DELETE"),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(deleted.status).toBe(200);
  });

  it("a tenant cannot delete another venue's benefit", async () => {
    currentVenueId = venueB;
    const { POST } = await import("@/app/api/guests/vip-tiers/route");
    const otherBenefit = await (await POST(jsonRequest("http://localhost/api/guests/vip-tiers", "POST", {
      tier: "vip", benefit: "B's benefit", category: "service",
    }))).json();

    currentVenueId = venueA;
    const { DELETE } = await import("@/app/api/guests/vip-tiers/[id]/route");
    const res = await DELETE(
      jsonRequest(`http://localhost/api/guests/vip-tiers/${otherBenefit.id}`, "DELETE"),
      { params: Promise.resolve({ id: otherBenefit.id }) },
    );
    expect(res.status).toBe(404);
  });
});

describe("session notes route handlers (plan 17)", () => {
  let testDb: TestDb;
  let prisma: PrismaClient;
  const venueA = "notes-venue-a";

  beforeAll(async () => {
    testDb = await createTestDb();
    prisma = testDb.rawClient;
    await makeVenue(prisma, venueA);
    currentVenueId = venueA;
    await prisma.zone.create({ data: { id: "zone-1", venueId: venueA, name: "Main", color: "#60a5fa" } });
    await prisma.venueTable.create({
      data: {
        id: "table-1", venueId: venueA, zoneId: "zone-1", code: "M-01", label: "Main 1",
        seats: 4, status: "open", qrSlug: "table-1.test",
      },
    });
    await prisma.guestSession.create({
      data: {
        id: "sess-1", venueId: venueA, tableId: "table-1", tableCode: "M-01",
        zoneName: "Main", displayName: "Alex + 1", partySize: 2,
        status: "approved",
      },
    });
  }, 60_000);

  afterAll(async () => {
    await testDb?.teardown();
  });

  it("adds a note to a session and lists it back, newest first", async () => {
    const { POST } = await import("@/app/api/sessions/[id]/notes/route");
    await POST(
      jsonRequest("http://localhost/api/sessions/sess-1/notes", "POST", {
        note: "Celebrating a birthday", staffId: "st-1", staffName: "Sofia",
      }),
      { params: Promise.resolve({ id: "sess-1" }) },
    );
    await POST(
      jsonRequest("http://localhost/api/sessions/sess-1/notes", "POST", {
        note: "Requested quieter table", staffId: "st-2", staffName: "Theo",
      }),
      { params: Promise.resolve({ id: "sess-1" }) },
    );

    const { GET } = await import("@/app/api/sessions/[id]/notes/route");
    const list = await (await GET(
      jsonRequest("http://localhost/api/sessions/sess-1/notes", "GET"),
      { params: Promise.resolve({ id: "sess-1" }) },
    )).json() as { note: string }[];
    expect(list.length).toBe(2);
    expect(list[0].note).toBe("Requested quieter table");
  });

  it("refuses to add a note to a session that does not exist", async () => {
    const { POST } = await import("@/app/api/sessions/[id]/notes/route");
    const res = await POST(
      jsonRequest("http://localhost/api/sessions/no-such-session/notes", "POST", {
        note: "Should not land", staffId: "st-1", staffName: "Sofia",
      }),
      { params: Promise.resolve({ id: "no-such-session" }) },
    );
    expect(res.status).toBe(404);
  });
});
