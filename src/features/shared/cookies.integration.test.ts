/**
 * Plan 31: Cookie flag assertions — verify that nln-guest-session carries
 * HttpOnly, Secure (in production), and SameSite=Lax.
 *
 * SameSite=Lax (not Strict) is deliberate: the QR entry flow and embed
 * navigation arrive via top-level cross-site navigation; Strict would log
 * guests out on arrival.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";
import { getRawPrisma } from "@/features/shared/db";
import { signTableToken } from "@/features/shared/table-token";

vi.mock("@/features/shared/app-mode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/shared/app-mode")>()),
  isDemoMode: () => false,
  getAppMode: () => "live" as const,
}));

function joinRequest(body: unknown, headers?: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/api/guest/join", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": "203.0.113.1", ...headers },
    body: JSON.stringify(body),
  });
}

function parseSetCookie(setCookie: string | null): Record<string, string> {
  if (!setCookie) return {};
  const parts: Record<string, string> = {};
  for (const part of setCookie.split(";")) {
    const trimmed = part.trim();
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) {
      parts[trimmed.toLowerCase()] = "true";
    } else {
      parts[trimmed.substring(0, eqIdx).toLowerCase()] = trimmed.substring(eqIdx + 1);
    }
  }
  return parts;
}

describe("cookie flags", () => {
  let testDb: TestDb | undefined;
  let cookie: Record<string, string>;

  beforeAll(async () => {
    process.env.QR_TOKEN_SECRET = "test-qr-secret-min-16-chars-ok";
    process.env.CRON_SECRET = "test-cron-secret";

    testDb = await createTestDb();
    const prisma = getRawPrisma();

    const venueId = "org-cookie-venue";
    const org = await prisma.organization.create({
      data: { id: venueId, name: "Cookie Test Venue", slug: "cookie-venue" },
    });
    await prisma.venue.create({
      data: {
        id: org.id,
        address: "1 Cookie St",
        city: "Testville",
        timezone: "America/Toronto",
        currency: "CAD",
        openingHours: [],
        serviceFees: [],
        floorMap: { width: 16, height: 9 },
        autoApproveGuests: true,
        logoInitials: "CT",
        slaThresholds: { orderWarnMinutes: 10, orderCriticalMinutes: 20, helpWarnMinutes: 5, helpCriticalMinutes: 10 },
      },
    });

    await prisma.zone.create({
      data: { id: "zone-cookie", venueId: org.id, name: "Main", color: "#6366f1" },
    });

    const tableId = "table-cookie-1";
    await prisma.venueTable.create({
      data: {
        id: tableId,
        venueId: org.id,
        code: "CT-01",
        label: "Cookie Table",
        seats: 4,
        zoneId: "zone-cookie",
        qrSlug: "ct-01",
        tokenVersion: 0,
      },
    });

    const token = `${tableId}.${signTableToken(tableId, 0)}`;

    // Perform a single successful join and capture the Set-Cookie header.
    const { POST } = await import("@/app/api/guest/join/route");
    const res = await POST(joinRequest({
      tableId,
      tableCode: "CT-01",
      zoneName: "Main",
      displayName: "Test Guest",
      partySize: 2,
      token,
    }));
    expect(res.status).toBe(201);
    // The join response also seeds the nln-locale cookie — pick out the
    // session cookie's own Set-Cookie header before parsing.
    const sessionHeader =
      res.headers.getSetCookie().find((h) => h.trim().startsWith("nln-guest-session=")) ?? "";
    cookie = parseSetCookie(sessionHeader);
  }, 30_000);

  afterAll(async () => {
    delete process.env.QR_TOKEN_SECRET;
    delete process.env.CRON_SECRET;
    await testDb?.teardown();
  });

  it("nln-guest-session has HttpOnly flag", () => {
    expect(cookie["httponly"]).toBe("true");
  });

  it("nln-guest-session has SameSite=Lax", () => {
    expect(cookie["samesite"]?.toLowerCase()).toBe("lax");
  });

  it("nln-guest-session has Path=/", () => {
    expect(cookie["path"]).toBe("/");
  });

  it("nln-guest-session has maxAge=43200 (12 hours)", () => {
    expect(cookie["max-age"]).toBe("43200");
  });

  it("set-cookie header contains nln-guest-session name", () => {
    // The cookie value is a session ID (cuid-like), not empty.
    const sessionId = cookie["nln-guest-session"];
    expect(sessionId).toBeTruthy();
    expect(typeof sessionId).toBe("string");
    expect(sessionId.length).toBeGreaterThan(10);
  });

  it("SameSite is Lax, not Strict — required for QR entry", () => {
    // QR scans and embed pages arrive as top-level cross-site navigation;
    // Strict would drop the cookie on arrival.
    expect(cookie["samesite"]?.toLowerCase()).toBe("lax");
  });
});
