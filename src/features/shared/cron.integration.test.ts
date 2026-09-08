import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";
import { runCronJob } from "@/features/shared/cron";

function req(ip: string, secret = "test-cron-secret") {
  return new NextRequest("http://localhost/api/jobs/test", {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "x-real-ip": ip },
  });
}

describe("cron runner (job route preamble)", () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await createTestDb();
    process.env.CRON_SECRET = "test-cron-secret";
    await testDb.rawClient.tenant.create({ data: { id: "tenant-a", name: "Tenant A", slug: "tenant-a", plan: "starter", status: "active" } });
    await testDb.rawClient.tenant.create({ data: { id: "tenant-b", name: "Tenant B", slug: "tenant-b", plan: "starter", status: "active" } });
  }, 60_000);

  afterAll(async () => {
    delete process.env.CRON_SECRET;
    await testDb?.teardown();
  });

  it("rejects a missing bearer", async () => {
    const res = await runCronJob(new NextRequest("http://localhost/api/jobs/test", { method: "POST" }), {
      name: "t1",
      run: async () => 1,
    });
    expect((res as Response).status).toBe(401);
  });

  it("rate-limits after 5 requests from one IP", async () => {
    const spec = { name: "t2", run: async () => 1 };
    for (let i = 0; i < 5; i++) {
      const r = await runCronJob(req("10.9.9.9"), spec) as { tenants: number };
      expect(r.tenants).toBe(2);
    }
    const sixth = await runCronJob(req("10.9.9.9"), spec);
    expect((sixth as Response).status).toBe(429);
  });

  it("runs every tenant once and completes the claim", async () => {
    const res = await runCronJob(req("10.0.0.1"), {
      name: "t3",
      run: async (tenant) => tenant.id,
    }) as { tenants: number; results: string[] };
    expect(res.tenants).toBe(2);
    expect([...res.results].sort()).toEqual(["tenant-a", "tenant-b"]);
    const runs = await testDb.rawClient.jobRun.findMany({ where: { jobName: { startsWith: "t3:" } } });
    expect(runs.length).toBe(2);
    expect(runs.every((r) => r.status === "completed")).toBe(true);
  });

  it("skips an already-completed day's run", async () => {
    const spec = { name: "t4", run: async () => 1 };
    const first = await runCronJob(req("10.0.0.2"), spec) as { results: number[] };
    expect(first.results).toHaveLength(2);
    const second = await runCronJob(req("10.0.0.2"), spec) as { results: number[] };
    expect(second.results).toHaveLength(0);
  });

  it("calls afterAll exactly once", async () => {
    let calls = 0;
    const res = await runCronJob(req("10.0.0.3"), {
      name: "t5",
      run: async () => 1,
      afterAll: async () => { calls++; },
    }) as { results: number[] };
    expect(res.results).toHaveLength(2);
    expect(calls).toBe(1);
  });
});
