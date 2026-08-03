import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";
import { logger } from "@/features/shared/logger";

function demoHandler() {
  return NextResponse.json({ error: "Cron jobs are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const CRON_SECRET = process.env.CRON_SECRET;
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { getClientIp, checkRateLimit } = await import("@/features/shared/rate-limit");
  const ip = getClientIp(request);
  const rl = checkRateLimit(`jobs:ip:${ip}`, { maxTokens: 5, refillRate: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const { getRawPrisma, getDb } = await import("@/features/shared/db");
  const { computeRollup, upsertRollup } = await import("@/features/analytics/analytics-core");
  const { nightContaining } = await import("@/features/shared/night");
  const { claimJobRun, completeJobRun, failJobRun } = await import("@/features/shared/job-claim");

  const prisma = getRawPrisma();
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  let rolled = 0;

  for (const tenant of tenants) {
    let jobKey = "";
    try {
      const today = new Date();
      const todayIso = today.toISOString().slice(0, 10);
      jobKey = `nightly-rollup:${tenant.id}:${todayIso}`;

      if (!(await claimJobRun(prisma, tenant.id, jobKey))) continue;

      const venue = await prisma.venue.findUnique({ where: { id: tenant.id } });
      if (!venue) {
        await completeJobRun(prisma, tenant.id, jobKey);
        continue;
      }

      const config = { nightStartHour: venue.nightStartHour, nightEndHour: venue.nightEndHour, timezone: venue.timezone };
      const night = nightContaining(today, config);
      const db = getDb({ venueId: tenant.id });
      const rollup = await computeRollup(db, tenant.id, night);
      await upsertRollup(prisma, tenant.id, night.label, rollup);
      rolled++;

      await completeJobRun(prisma, tenant.id, jobKey);
    } catch (err) {
      logger.error(`[nightly-rollup] Tenant ${tenant.id}:`, { error: String(err) });
      await failJobRun(prisma, tenant.id, jobKey);
    }
  }

  return NextResponse.json({ ok: true, rolled });
}

export const POST = isDemoMode() ? demoHandler : livePOST;
