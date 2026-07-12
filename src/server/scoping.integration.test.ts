import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { execSync } from "node:child_process";
import { getDb, type SessionContext } from "./db";

describe("tenant scoping (AD-3 canary)", () => {
  let container: StartedPostgreSqlContainer;
  let rawClient: PrismaClient;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:17-alpine").start();
    const url = container.getConnectionUri();

    process.env.DATABASE_URL = url;
    process.env.AUTH_SECRET = "test-secret-at-least-16";

    execSync(`npx prisma migrate deploy`, {
      env: { ...process.env, DATABASE_URL: url },
      cwd: process.cwd(),
    });

    const adapter = new PrismaPg(url);
    rawClient = new PrismaClient({ adapter });
  });

  afterAll(async () => {
    await rawClient?.$disconnect();
    await container?.stop();
  });

  it("scoped client cannot read another tenant's rows", async () => {
    const tenantA = await rawClient.tenant.create({
      data: { name: "Venue A", slug: "venue-a", plan: "pro", status: "active" },
    });
    const tenantB = await rawClient.tenant.create({
      data: { name: "Venue B", slug: "venue-b", plan: "starter", status: "active" },
    });

    await rawClient.jobRun.create({
      data: { tenantId: tenantA.id, jobName: "nightly-report", status: "completed" },
    });
    await rawClient.jobRun.create({
      data: { tenantId: tenantB.id, jobName: "nightly-report", status: "completed" },
    });

    const sessionA: SessionContext = { venueId: tenantA.id };
    const sessionB: SessionContext = { venueId: tenantB.id };

    const dbA = getDb(sessionA);
    const dbB = getDb(sessionB);

    const jobsA = await dbA.jobRun.findMany();
    const jobsB = await dbB.jobRun.findMany();

    expect(jobsA).toHaveLength(1);
    expect(jobsA[0].tenantId).toBe(tenantA.id);
    expect(jobsB).toHaveLength(1);
    expect(jobsB[0].tenantId).toBe(tenantB.id);
  });
});
