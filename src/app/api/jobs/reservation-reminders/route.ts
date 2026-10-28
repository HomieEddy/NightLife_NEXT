import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Cron jobs are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest) {
  const { runCronJob } = await import("@/features/shared/cron");
  const { venueDayKey } = await import("@/features/shared/night");
  const { dispatch } = await import("@/features/notifications/dispatch");
  const { normalizePhone } = await import("@/lib/phone");
  await import("@/features/notifications/templates");

  const outcome = await runCronJob(request, {
    name: "reservation-reminders",
    // Day key in the VENUE's timezone — a UTC day key near midnight venue-
    // local could skip or duplicate a day's run.
    dayKey: async (tenant, now, prisma) => {
      const venue = await prisma.venue.findUnique({
        where: { id: tenant.id },
        select: { timezone: true },
      });
      return venueDayKey(now, venue?.timezone ?? "UTC");
    },
    run: async (tenant, now, prisma, { dayKey }) => {
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

      let sent = 0;
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
          idempotencyKey: `reminder:${res.id}:${dayKey}`,
        });
        sent += result.sent;
      }
      return sent;
    },
  });

  if (!("results" in outcome)) return outcome;
  return NextResponse.json({ ok: true, sent: outcome.results.reduce((sum, n) => sum + n, 0) });
}

export const POST = isDemoMode() ? demoHandler : livePOST;
