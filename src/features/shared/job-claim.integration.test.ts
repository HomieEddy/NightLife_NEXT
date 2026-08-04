import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb, type TestDb } from "@/features/shared/test-pglite";
import {
  claimJobRun,
  completeJobRun,
  failJobRun,
  verifyBearerToken,
  STALE_RUN_MS,
} from "./job-claim";

describe("job-claim (integration)", () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await createTestDb();
  }, 60_000);

  afterAll(async () => {
    await testDb?.teardown();
  });

  /** job_runs has an FK to tenants — every test tenant needs a row. */
  async function makeTenant(id: string) {
    await testDb.rawClient.tenant.create({
      data: { id, name: `Tenant ${id}`, slug: `tenant-${id}`, plan: "starter", status: "active" },
    });
  }

  async function makeTenants(ids: string[]) {
    for (const id of ids) await makeTenant(id);
  }

  it("verifyBearerToken accepts the right secret and rejects wrong/missing", () => {
    const secret = "supersecret-cron-123";
    expect(verifyBearerToken(`Bearer ${secret}`, secret)).toBe(true);
    expect(verifyBearerToken("Bearer wrong", secret)).toBe(false);
    expect(verifyBearerToken(null, secret)).toBe(false);
    expect(verifyBearerToken(`Bearer ${secret}`, undefined)).toBe(false);
    // Length mismatch must not throw (timingSafeEqual requires equal lengths).
    expect(verifyBearerToken("Bearer short", "a-much-longer-secret-value-here")).toBe(false);
  });

  it("claims a run once and rejects a duplicate claim for the same job", async () => {
    const prisma = testDb.rawClient;
    await makeTenant("tenant-1");
    const jobName = "test:tenant-1:2026-08-03";

    expect(await claimJobRun(prisma, "tenant-1", jobName)).toBe(true);
    // Second claim — same tenant+job — is refused (unique constraint + skipDuplicates).
    expect(await claimJobRun(prisma, "tenant-1", jobName)).toBe(false);
  });

  it("lets a different tenant claim the same job name independently", async () => {
    const prisma = testDb.rawClient;
    await makeTenants(["tenant-a", "tenant-b"]);
    const jobName = "test:day-shared:2026-08-03";
    expect(await claimJobRun(prisma, "tenant-a", jobName)).toBe(true);
    expect(await claimJobRun(prisma, "tenant-b", jobName)).toBe(true);
  });

  it("steals a stale running run (crashed > 30 min) and lets the next run proceed", async () => {
    const prisma = testDb.rawClient;
    await makeTenant("tenant-stale");
    const jobName = "test:stale:2026-08-03";

    expect(await claimJobRun(prisma, "tenant-stale", jobName)).toBe(true);
    // Age the run past the stale threshold.
    await prisma.jobRun.updateMany({
      where: { tenantId: "tenant-stale", jobName },
      data: { startedAt: new Date(Date.now() - STALE_RUN_MS - 1000) },
    });

    // A fresh run steals it and proceeds.
    expect(await claimJobRun(prisma, "tenant-stale", jobName)).toBe(true);

    // There is still exactly one running row — the steal reused it.
    const rows = await prisma.jobRun.findMany({
      where: { tenantId: "tenant-stale", jobName, status: "running" },
    });
    expect(rows).toHaveLength(1);
  });

  it("does NOT steal a fresh running run — a concurrent invocation backs off", async () => {
    const prisma = testDb.rawClient;
    await makeTenant("tenant-fresh");
    const jobName = "test:fresh:2026-08-03";
    expect(await claimJobRun(prisma, "tenant-fresh", jobName)).toBe(true);
    expect(await claimJobRun(prisma, "tenant-fresh", jobName)).toBe(false);
  });

  it("completeJobRun marks the claim completed and failJobRun marks it failed", async () => {
    const prisma = testDb.rawClient;
    await makeTenant("tenant-done");
    const jobName = "test:done:2026-08-03";
    expect(await claimJobRun(prisma, "tenant-done", jobName)).toBe(true);
    await completeJobRun(prisma, "tenant-done", jobName);
    expect(
      (await prisma.jobRun.findFirst({ where: { tenantId: "tenant-done", jobName } }))?.status,
    ).toBe("completed");

    const failedName = "test:failed:2026-08-03";
    await makeTenant("tenant-failed");
    expect(await claimJobRun(prisma, "tenant-failed", failedName)).toBe(true);
    await failJobRun(prisma, "tenant-failed", failedName);
    expect(
      (await prisma.jobRun.findFirst({ where: { tenantId: "tenant-failed", jobName: failedName } }))
        ?.status,
    ).toBe("failed");
  });

  it("after completion, the same job claim is refused (idempotency)", async () => {
    const prisma = testDb.rawClient;
    const jobName = "test:done:2026-08-03";
    expect(await claimJobRun(prisma, "tenant-done", jobName)).toBe(false);
  });
});
