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

  const { getRawPrisma, getDb } = await import("@/features/shared/db");
  const { computeRollup, upsertRollup } = await import("@/server/analytics-core");
  const { nightContaining } = await import("@/features/shared/night");

  const prisma = getRawPrisma();
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  let rolled = 0;

  for (const tenant of tenants) {
    try {
      const today = new Date();
      const todayIso = today.toISOString().slice(0, 10);
      const jobKey = `nightly-rollup:${tenant.id}:${todayIso}`;

      const existing = await prisma.jobRun.findFirst({
        where: { tenantId: tenant.id, jobName: jobKey, status: "completed" },
      });
      if (existing) continue;

      await prisma.jobRun.create({
        data: { tenantId: tenant.id, jobName: jobKey, status: "running", startedAt: new Date() },
      });

      // TODO(backend): nightContaining needs venue nightStartHour/nightEndHour —
      // fetch the Venue row per tenant and pass the config.
      const venue = await prisma.venue.findUnique({ where: { id: tenant.id } });
      if (!venue) continue;

      const config = { nightStartHour: venue.nightStartHour, nightEndHour: venue.nightEndHour, timezone: venue.timezone };
      const night = nightContaining(today, config);
      const db = getDb({ venueId: tenant.id });
      const rollup = await computeRollup(db, tenant.id, night);
      await upsertRollup(prisma, tenant.id, night.label, rollup);
      rolled++;

      const run = await prisma.jobRun.findFirst({ where: { tenantId: tenant.id, jobName: jobKey, status: "running" } });
      if (run) await prisma.jobRun.update({ where: { id: run.id }, data: { status: "completed", endedAt: new Date() } });
    } catch (err) {
      logger.error(`[nightly-rollup] Tenant ${tenant.id}:`, { error: String(err) });
    }
  }

  return NextResponse.json({ ok: true, rolled });
}

export const POST = isDemoMode() ? demoHandler : livePOST;
