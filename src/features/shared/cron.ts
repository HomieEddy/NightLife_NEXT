/**
 * Cron runner — the single owner of the job-route preamble: bearer auth,
 * per-IP rate limit, tenant fan-out, and the claim/complete/fail lifecycle.
 * A job route supplies only its domain body; the guards change in one place.
 */
import { NextResponse, type NextRequest } from "next/server";
import type { PrismaClient } from "@prisma/client";
import { verifyBearerToken, claimJobRun, completeJobRun, failJobRun } from "./job-claim";
import { getClientIp, checkRateLimit } from "./rate-limit";
import { apiRateLimitError } from "./api-error";
import { getRawPrisma } from "./db";
import { logger } from "./logger";

export interface CronTenant {
  id: string;
  name: string;
}

export interface CronJobSpec<T> {
  /** Job name — the claim's jobKey prefix, e.g. "reservation-reminders". */
  name: string;
  /** Day key per tenant (the claim's date suffix). Default: UTC YYYY-MM-DD. */
  dayKey?: (tenant: CronTenant, now: Date, prisma: PrismaClient) => Promise<string> | string;
  /** The job's per-tenant body. Return whatever the route aggregates. */
  run: (tenant: CronTenant, now: Date, prisma: PrismaClient, ctx: { dayKey: string; jobKey: string }) => Promise<T>;
  /** Platform-scope work after the tenant loop (runs once). */
  afterAll?: (prisma: PrismaClient) => Promise<void>;
}

export type CronResult<T> = { tenants: number; results: T[] } | NextResponse;

export async function runCronJob<T>(request: NextRequest, spec: CronJobSpec<T>): Promise<CronResult<T>> {
  if (!verifyBearerToken(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request);
  const rl = checkRateLimit(`jobs:ip:${ip}`, { maxTokens: 5, refillRate: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    return apiRateLimitError(rl.retryAfterMs);
  }

  const prisma = getRawPrisma();
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  const now = new Date();
  const results: T[] = [];

  for (const tenant of tenants) {
    const dayKey = await (spec.dayKey
      ? spec.dayKey(tenant, now, prisma)
      : now.toISOString().slice(0, 10));
    const jobKey = `${spec.name}:${tenant.id}:${dayKey}`;
    try {
      if (!(await claimJobRun(prisma, tenant.id, jobKey))) continue;
      results.push(await spec.run(tenant, now, prisma, { dayKey, jobKey }));
      await completeJobRun(prisma, tenant.id, jobKey);
    } catch (err) {
      logger.error(`[${spec.name}] Tenant ${tenant.id}:`, { error: String(err) });
      await failJobRun(prisma, tenant.id, jobKey);
    }
  }

  if (spec.afterAll) await spec.afterAll(prisma);

  return { tenants: tenants.length, results };
}
