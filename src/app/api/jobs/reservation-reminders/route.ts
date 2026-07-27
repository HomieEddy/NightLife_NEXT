import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Cron jobs are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const CRON_SECRET = process.env.CRON_SECRET;
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { getRawPrisma } = await import("@/server/db");
  const { dispatch } = await import("@/server/notifications/dispatch");
  const { normalizePhone } = await import("@/lib/phone");
  await import("@/server/notifications/templates");

  const prisma = getRawPrisma();
  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  let sent = 0;
  const now = new Date();

  for (const tenant of tenants) {
    try {
      const todayIso = now.toISOString().slice(0, 10);
      const jobKey = `reservation-reminders:${tenant.id}:${todayIso}`;

      const existing = await prisma.jobRun.findFirst({
        where: { tenantId: tenant.id, jobName: jobKey, status: "completed" },
      });
      if (existing) continue;

      await prisma.jobRun.create({
        data: { tenantId: tenant.id, jobName: jobKey, status: "running", startedAt: new Date() },
      });

      // Find confirmed reservations starting in the next 2 hours
      const windowStart = new Date(now.getTime() + 60 * 60_000); // 1 hour from now
      const windowEnd = new Date(now.getTime() + 3 * 3600_000); // 3 hours
      const reservations = await prisma.reservation.findMany({
        where: {
          venueId: tenant.id,
          status: "confirmed",
          startsAt: { gte: windowStart, lte: windowEnd },
        },
      });

      for (const res of reservations) {
        const recipient: { email?: string; phone?: string } = {};
        if (res.guestEmail) recipient.email = res.guestEmail;
        if ((res as Record<string, unknown>).guestPhone) {
          const p = normalizePhone((res as Record<string, unknown>).guestPhone as string);
          if (p) recipient.phone = p;
        }
        if (!recipient.email && !recipient.phone) continue;

        const startTime = new Date(res.startsAt).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" });
        const result = await dispatch(prisma, {
          venueId: tenant.id,
          template: "reservation-reminder",
          recipients: [recipient],
          data: {
            venueName: tenant.id,
            guestName: res.guestName,
            time: startTime,
            partySize: res.partySize,
          },
          idempotencyKey: `reminder:${res.id}:${todayIso}`,
        });
        sent += result.sent;
      }

      const run = await prisma.jobRun.findFirst({ where: { tenantId: tenant.id, jobName: jobKey, status: "running" } });
      if (run) await prisma.jobRun.update({ where: { id: run.id }, data: { status: "completed", endedAt: new Date() } });
    } catch (err) {
      console.error(`[reservation-reminders] Tenant ${tenant.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, sent });
}

export const POST = isDemoMode() ? demoHandler : livePOST;
