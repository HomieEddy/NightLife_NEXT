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

  const { getRawPrisma } = await import("@/features/shared/db");
  const { dispatch } = await import("@/features/notifications/dispatch");
  const { normalizePhone } = await import("@/lib/phone");
  const { claimJobRun, completeJobRun, failJobRun } = await import("@/features/shared/job-claim");
  await import("@/features/notifications/templates");

  const prisma = getRawPrisma();
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  let sent = 0;
  const now = new Date();

  for (const tenant of tenants) {
    let jobKey = "";
    try {
      // Day key in the VENUE's timezone — a UTC day key near midnight venue-
      // local could skip or duplicate a day's run.
      const venue = await prisma.venue.findUnique({
        where: { id: tenant.id },
        select: { timezone: true },
      });
      const tz = venue?.timezone ?? "UTC";
      const [m, d, y] = now
        .toLocaleString("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
        .split("/");
      const todayIso = `${y}-${m}-${d}`;
      jobKey = `reservation-reminders:${tenant.id}:${todayIso}`;

      if (!(await claimJobRun(prisma, tenant.id, jobKey))) continue;

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
            venueName: tenant.name,
            guestName: res.guestName,
            time: startTime,
            partySize: res.partySize,
          },
          locale: (res.bookingLocale as "en" | "fr") ?? "en",
          idempotencyKey: `reminder:${res.id}:${todayIso}`,
        });
        sent += result.sent;
      }

      await completeJobRun(prisma, tenant.id, jobKey);
    } catch (err) {
      logger.error(`[reservation-reminders] Tenant ${tenant.id}:`, { error: String(err) });
      await failJobRun(prisma, tenant.id, jobKey);
    }
  }

  return NextResponse.json({ ok: true, sent });
}

export const POST = isDemoMode() ? demoHandler : livePOST;
