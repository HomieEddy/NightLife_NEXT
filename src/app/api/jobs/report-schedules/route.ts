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

  const { getRawPrisma } = await import("@/features/shared/db");
  const { findDueReports } = await import("@/features/analytics/report-core");
  const { dispatch: notify } = await import("@/features/notifications/dispatch");
  await import("@/features/notifications/templates");

  const prisma = getRawPrisma();
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  let sent = 0;

  for (const tenant of tenants) {
    try {
      const jobKey = `report-schedules:${tenant.id}`;
      const today = new Date();

      // ponytail: idempotency check — same (tenant, job, date) runs once
      const existing = await prisma.jobRun.findFirst({
        where: { tenantId: tenant.id, jobName: jobKey, status: "completed" },
      });
      if (existing) continue;

      await prisma.jobRun.create({
        data: { tenantId: tenant.id, jobName: jobKey, status: "running", startedAt: new Date() },
      });

      // TODO(backend): the db returned by findDueReports needs explicit venueId filtering
      // since we're iterating cross-tenant with getRawPrisma. For now, find due reports
      // by querying the tenant's SavedReport rows directly.
      const reports = await prisma.savedReport.findMany({
        where: { venueId: tenant.id },
        include: { runs: { orderBy: { ranAt: "desc" }, take: 1 } },
      });

      const due = reports.filter((r) => {
        const schedule = r.schedule as { frequency: string } | null;
        if (!schedule) return false;
        if (schedule.frequency === "daily") return true;
        if (schedule.frequency === "weekly") return today.getDay() === 1;
        if (schedule.frequency === "monthly") return today.getDate() === 1;
        return false;
      });

      for (const report of due) {
        const recipient = (report.schedule as { recipient?: string } | null)?.recipient;
        if (recipient) {
          const result = await notify(prisma, {
            venueId: tenant.id,
            template: "report-run",
            recipients: [{ email: recipient }],
            data: {
              venueName: tenant.id,
              reportName: report.name,
              periodLabel: today.toISOString().slice(0, 10),
              summary: `Report: ${report.name}\n${(report.metrics as string[]).length} metrics`,
            },
            idempotencyKey: jobKey,
          });
          sent += result.sent;
        }
      }

      const run = await prisma.jobRun.findFirst({ where: { tenantId: tenant.id, jobName: jobKey, status: "running" } });
      if (run) await prisma.jobRun.update({ where: { id: run.id }, data: { status: "completed", endedAt: new Date() } });
    } catch (err) {
      logger.error(`[report-schedules] Tenant ${tenant.id}:`, { error: String(err) });
    }
  }

  return NextResponse.json({ ok: true, sent });
}

export const POST = isDemoMode() ? demoHandler : livePOST;
