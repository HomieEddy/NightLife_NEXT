/**
 * Plan 31: Rate-limit integration tests — verify that rate-limited route
 * handlers return 429 + Retry-After when burst.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";
import { _resetBuckets } from "@/features/shared/rate-limit";

vi.mock("@/features/shared/app-mode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/shared/app-mode")>()),
  isDemoMode: () => false,
  getAppMode: () => "live" as const,
}));

function jsonPost(body: unknown, headers?: Record<string, string>): NextRequest {
  return new Request("http://localhost/api/public/reservations/table/test-table-id/pin", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": "203.0.113.42", ...headers },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

function jsonGet(headers?: Record<string, string>): NextRequest {
  return new Request("http://localhost/api/public/reservations/table/test-table-id/active", {
    method: "GET",
    headers: { "x-real-ip": "203.0.113.42", ...headers },
  }) as unknown as NextRequest;
}

describe("rate limit integration", () => {
  let testDb: TestDb | undefined;

  beforeAll(async () => {
    testDb = await createTestDb();
  }, 30_000);

  afterAll(async () => {
    await testDb?.teardown();
  });

  beforeEach(() => {
    _resetBuckets();
  });

  it("PIN route returns 429 + Retry-After after 5 attempts", async () => {
    const { POST } = await import("@/app/api/public/reservations/table/[tableId]/pin/route");

    // First 5 should be 4xx (bad PIN) or 404 (table not found), not 429.
    for (let i = 0; i < 5; i++) {
      const res = await POST(jsonPost({ pin: "000000" }), {
        params: Promise.resolve({ tableId: `table-a-${i}` }),
      });
      expect(res.status).not.toBe(429);
    }

    // 6th attempt across all keys from the same IP — the PIN route keys by
    // `resv-pin:${tableId}:${ip}`. Since each request used a different tableId,
    // each got its own bucket. To really trip the limiter we need the same key.
    // Use a dedicated table+IP that we burst.
    const keyTableId = "burst-table";
    for (let i = 0; i < 5; i++) {
      await POST(jsonPost({ pin: "000000" }), {
        params: Promise.resolve({ tableId: keyTableId }),
      });
    }

    const res = await POST(jsonPost({ pin: "000000" }), {
      params: Promise.resolve({ tableId: keyTableId }),
    });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    const retryAfter = Number(res.headers.get("Retry-After"));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60); // 5 min window / 5 tokens = 60s
  });

  it("active route returns 429 after burst", async () => {
    const { GET } = await import("@/app/api/public/reservations/table/[tableId]/active/route");

    const keyTableId = "burst-active";
    for (let i = 0; i < 10; i++) {
      await GET(jsonGet(), {
        params: Promise.resolve({ tableId: keyTableId }),
      });
    }

    const res = await GET(jsonGet(), {
      params: Promise.resolve({ tableId: keyTableId }),
    });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("Retry-After header is a positive integer seconds", async () => {
    const { POST } = await import("@/app/api/public/reservations/table/[tableId]/pin/route");

    const tableId = "retry-header-test";
    for (let i = 0; i < 5; i++) {
      await POST(jsonPost({ pin: "000000" }), { params: Promise.resolve({ tableId }) });
    }
    const res = await POST(jsonPost({ pin: "000000" }), { params: Promise.resolve({ tableId }) });

    const retryAfter = res.headers.get("Retry-After");
    expect(retryAfter).toBeTruthy();
    const seconds = Number(retryAfter);
    expect(Number.isInteger(seconds)).toBe(true);
    expect(seconds).toBeGreaterThan(0);
  });
});
