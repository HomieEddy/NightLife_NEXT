import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";

vi.mock("@/features/shared/app-mode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/shared/app-mode")>()),
  isDemoMode: () => false,
  getAppMode: () => "live" as const,
}));

describe("GET /api/health (integration)", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  });

  afterAll(async () => {
    await db.teardown();
  });

  async function callHealth() {
    // Dynamic import after mock is installed so isDemoMode() returns false
    const { GET } = await import("./route");
    return GET(
      new Request("http://localhost/api/health", {
        headers: { "x-real-ip": "203.0.113.1" },
      }),
    );
  }

  it("returns 200 with status ok and db ok", async () => {
    const res = await callHealth();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.checks.db).toBe("ok");
    expect(typeof body.uptime).toBe("number");
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });

  it("returns 503 when DB is unreachable", async () => {
    // Tear down the DB handle to simulate an outage
    await db.teardown();

    const res = await callHealth();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.checks.db).toBe("error");

    // Re-create the DB for subsequent tests
    db = await createTestDb();
  });

  it("response shape includes status, uptime, and checks.db", async () => {
    const res = await callHealth();
    const body = await res.json();
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("uptime");
    expect(body).toHaveProperty("checks");
    expect(body.checks).toHaveProperty("db");
  });
});
