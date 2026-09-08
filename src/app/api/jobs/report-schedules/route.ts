import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Cron jobs are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest) {
  const { runCronJob } = await import("@/features/shared/cron");
  const { venueDayKey } = await import("@/features/shared/night");
  const { getDb } = await import("@/features/shared/db");
  const { findDueReports } = await import("@/features/analytics/report-core");
  const { dispatch: notify } = await import("@/features/notifications/dispatch");
  await import("@/features/notifications/templates");

  const outcome = await runCronJob(request, {
    name: "report-schedules",
    // Weekly/monthly cadence and the day key resolve in the VENUE's timezone,
    // not the server's — a venue in another tz must not fire on the wrong day.
    dayKey: async (tenant, now, prisma) => {
      const venue = await prisma.venue.findUnique({
        where: { id: tenant.id },
        select: { timezone: true },
      });
      return venueDayKey(now, venue?.timezone ?? "UTC");
    },
    run: async (tenant, now, prisma, { dayKey, jobKey }) => {
      const venue = await prisma.venue.findUnique({
        where: { id: tenant.id },
        select: { timezone: true },
      });
      const tz = venue?.timezone ?? "UTC";
      const due = await findDueReports(getDb({ venueId: tenant.id }), now, tz);

      let sent = 0;
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
              periodLabel: dayKey,
              summary: `Report: ${report.name}\n${(report.metrics as string[]).length} metrics`,
            },
            idempotencyKey: `${jobKey}:${report.id}`,
          });
          sent += result.sent;
        }
      }
      return sent;
    },
  });

  if (!("results" in outcome)) return outcome;
  return NextResponse.json({ ok: true, sent: outcome.results.reduce((sum, n) => sum + n, 0) });
}

export const POST = isDemoMode() ? demoHandler : livePOST;
