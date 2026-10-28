import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import type { NextRequest } from "next/server";
import { getDb, type SessionContext } from "@/features/shared/db";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";
import { createZone, createTable } from "@/features/venue/core";
import { createReservation, setReservationStatus } from "@/features/hospitality/reservation-core";
import { nightContaining, type NightConfig } from "@/features/shared/night";

const NIGHT_CONFIG: NightConfig = { timezone: "America/Montreal", nightStartHour: 18, nightEndHour: 10 };

/**
 * The guest QR landing calls these two routes with NO session — it runs before
 * the guest has joined anything. Auth is deliberately not mocked here: if a
 * staff guard is ever reintroduced, these tests fail, which is the point.
 *
 * Regression: both routes once called requireApiArea("staff"), so every
 * scanning guest got a 401 that the QR page rendered as "Table not found".
 */

vi.mock("@/features/shared/app-mode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/shared/app-mode")>()),
  isDemoMode: () => false,
  getAppMode: () => "live" as const,
}));

function jsonRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/public/reservations/table/x/pin", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": "203.0.113.9" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

async function makeVenue(rawClient: PrismaClient, name: string, slug: string) {
  const org = await rawClient.organization.create({ data: { id: `org-${slug}`, name, slug } });
  await rawClient.venue.create({
    data: {
      id: org.id,
      address: "1 Test St",
      city: "Testville",
      timezone: "America/Montreal",
      currency: "CAD",
      openingHours: [],
      serviceFees: [],
      floorMap: { width: 16, height: 9 },
      autoApproveGuests: false,
      logoInitials: "TT",
      slaThresholds: {
        orderWarnMinutes: 6,
        orderCriticalMinutes: 12,
        helpWarnMinutes: 4,
        helpCriticalMinutes: 8,
      },
      lastCallAutoFlagTables: true,
    },
  });
  return org.id;
}

describe("public reservation gate routes are reachable without a session (plan 13)", () => {
  let testDb: TestDb;
  let rawClient: PrismaClient;
  let venueA: string;
  let sessionA: SessionContext;
  let gatedTableId: string;
  let openTableId: string;
  let pin: string;

  beforeAll(async () => {
    testDb = await createTestDb();
    rawClient = testDb.rawClient;
    venueA = await makeVenue(rawClient, "Venue A", "pub-a");
    sessionA = { venueId: venueA };

    const db = getDb(sessionA);
    const zone = await createZone(db, venueA, {
      name: "Main", description: "", color: "cyan", capacity: null,
    });
    const gated = await createTable(db, venueA, {
      zoneId: zone.id, code: "VIP-01", label: "VIP 1", seats: 6,
      minimumSpend: null, status: "open",
    });
    const open = await createTable(db, venueA, {
      zoneId: zone.id, code: "M-01", label: "Main 1", seats: 4,
      minimumSpend: null, status: "open",
    });
    gatedTableId = gated.id;
    openTableId = open.id;

    // A confirmed reservation for the venue-night containing the real wall clock
    // is what arms the gate (nightContaining rolls before mid-afternoon back to
    // the previous night, so a booking is always seeded into tonight's night).
    const night = nightContaining(new Date(), NIGHT_CONFIG);
    const startsAt = new Date(night.start.getTime() + 3 * 3600_000);
    const res = await createReservation(db, venueA, {
      guestName: "Gated Party",
      guestEmail: "gated@example.com",
      guestPhone: "+15145550199",
      partySize: 4,
      startsAt: startsAt.toISOString(),
      tableId: gatedTableId,
      zoneId: zone.id,
      source: "manager",
    });
    const confirmed = await setReservationStatus(db, venueA, res.id, "confirmed");
    expect(confirmed.ok).toBe(true);

    const row = await rawClient.reservation.findUnique({ where: { id: res.id } });
    expect(row?.reservationPin).toBeTruthy();
    pin = row!.reservationPin!;
  }, 60_000);

  afterAll(async () => {
    await testDb?.teardown();
  });

  it("reports the gate to an unauthenticated guest", async () => {
    const { GET } = await import("@/app/api/public/reservations/table/[tableId]/active/route");
    const res = await GET(jsonRequest({}), { params: Promise.resolve({ tableId: gatedTableId }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tableId).toBe(gatedTableId);
    expect(body.status).toBe("confirmed");
  });

  it("never leaks the PIN or the booker's contact details", async () => {
    const { GET } = await import("@/app/api/public/reservations/table/[tableId]/active/route");
    const res = await GET(jsonRequest({}), { params: Promise.resolve({ tableId: gatedTableId }) });
    const body = await res.json();

    expect(body.reservationPin).toBeUndefined();
    expect(body.guestEmail).toBeUndefined();
    expect(body.guestPhone).toBeUndefined();
  });

  it("returns 404 for an ungated table so the join form renders", async () => {
    const { GET } = await import("@/app/api/public/reservations/table/[tableId]/active/route");
    const res = await GET(jsonRequest({}), { params: Promise.resolve({ tableId: openTableId }) });

    // 404 is the contract the live service maps to null — anything else (401
    // in particular) makes the QR page render "Table not found".
    expect(res.status).toBe(404);
  });

  it("rejects a wrong PIN without a session", async () => {
    const { POST } = await import("@/app/api/public/reservations/table/[tableId]/pin/route");
    const res = await POST(jsonRequest({ pin: "000000" }), {
      params: Promise.resolve({ tableId: gatedTableId }),
    });

    expect(res.status).toBe(403);
  });

  it("clears the gate with the correct PIN and seats the party", async () => {
    const { POST } = await import("@/app/api/public/reservations/table/[tableId]/pin/route");
    const res = await POST(jsonRequest({ pin }), {
      params: Promise.resolve({ tableId: gatedTableId }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const row = await rawClient.reservation.findFirst({ where: { tableId: gatedTableId } });
    expect(row?.status).toBe("seated");
    expect(row?.reservationPin).toBeNull();
  });

  it("rate-limits PIN guessing per table and IP", async () => {
    const { _resetBuckets } = await import("@/features/shared/rate-limit");
    _resetBuckets();
    const { POST } = await import("@/app/api/public/reservations/table/[tableId]/pin/route");

    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await POST(jsonRequest({ pin: "111111" }), {
        params: Promise.resolve({ tableId: openTableId }),
      });
      statuses.push(res.status);
    }

    // A 6-digit PIN is ~1M combinations; the bucket must close before the
    // seventh guess from the same IP.
    expect(statuses).toContain(429);
  });
});
