import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";
import { logger } from "@/features/shared/logger";

function demoHandler() {
  return NextResponse.json({ error: "Cron jobs are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest) {
  const { verifyBearerToken } = await import("@/features/shared/job-claim");
  if (!verifyBearerToken(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { getClientIp, checkRateLimit } = await import("@/features/shared/rate-limit");
  const { apiRateLimitError } = await import("@/features/shared/api-error");
  const ip = getClientIp(request);
  const rl = checkRateLimit(`jobs:ip:${ip}`, { maxTokens: 5, refillRate: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    return apiRateLimitError(rl.retryAfterMs);
  }

  const { getRawPrisma, getDb } = await import("@/features/shared/db");
  const { findDueReports } = await import("@/features/analytics/report-core");
  const { dispatch: notify } = await import("@/features/notifications/dispatch");
  const { claimJobRun, completeJobRun, failJobRun } = await import("@/features/shared/job-claim");
  await import("@/features/notifications/templates");

  const prisma = getRawPrisma();
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  let sent = 0;

  for (const tenant of tenants) {
    let jobKey = "";
    try {
      const today = new Date();

      // Weekly/monthly cadence and the day key resolve in the VENUE's
      // timezone, not the server's — a venue in another tz must not fire on
      // the wrong day, and a UTC day key could skip/duplicate a venue-local day.
      const venue = await prisma.venue.findUnique({
        where: { id: tenant.id },
        select: { timezone: true },
      });
      const tz = venue?.timezone ?? "UTC";
      const [m, d, y] = today
        .toLocaleString("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
        .split("/");
      const todayIso = `${y}-${m}-${d}`;
      // jobKey embeds the date — without it the first completed run blocked
      // every future run and daily/weekly/monthly reports stopped after day one.
      jobKey = `report-schedules:${tenant.id}:${todayIso}`;

      if (!(await claimJobRun(prisma, tenant.id, jobKey))) continue;

      // Cadence and day key both resolve in the VENUE's timezone (the same
      // tested function the report unit suite exercises).
      const due = await findDueReports(getDb({ venueId: tenant.id }), today, tz);

      for (const report of due) {
        const recipient = (report.schedule as { recipient?: string } | null)?.recipient;
        if (recipient) {
          const result = await notify(prisma, {
            venueId: tenant.id,
            template: "report-run",
            recipients: [{ email: recipient }],
            data: {
              venueName: tenant.name,
              reportName: report.name,
              periodLabel: todayIso,
              summary: `Report: ${report.name}\n${(report.metrics as string[]).length} metrics`,
            },
            idempotencyKey: `${jobKey}:${report.id}`,
          });
          sent += result.sent;
        }
      }

      await completeJobRun(prisma, tenant.id, jobKey);
    } catch (err) {
      logger.error(`[report-schedules] Tenant ${tenant.id}:`, { error: String(err) });
      await failJobRun(prisma, tenant.id, jobKey);
    }
  }

  return NextResponse.json({ ok: true, sent });
}

export const POST = isDemoMode() ? demoHandler : livePOST;
