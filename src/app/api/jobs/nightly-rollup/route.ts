import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Cron jobs are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest) {
  const { runCronJob } = await import("@/features/shared/cron");
  const { getDb } = await import("@/features/shared/db");
  const { computeRollup, upsertRollup } = await import("@/features/analytics/analytics-core");
  const { nightContaining } = await import("@/features/shared/night");

  const outcome = await runCronJob(request, {
    name: "nightly-rollup",
    run: async (tenant, now, prisma) => {
      const venue = await prisma.venue.findUnique({ where: { id: tenant.id } });
      if (!venue) return 0;

      const config = { nightStartHour: venue.nightStartHour, nightEndHour: venue.nightEndHour, timezone: venue.timezone };
      const night = nightContaining(now, config);
      const db = getDb({ venueId: tenant.id });
      const rollup = await computeRollup(db, tenant.id, night);
      await upsertRollup(prisma, tenant.id, night.label, rollup);
      return 1;
    },
  });

  if (!("results" in outcome)) return outcome;
  return NextResponse.json({ ok: true, rolled: outcome.results.reduce<number>((sum, n) => sum + n, 0) });
}

export const POST = isDemoMode() ? demoHandler : livePOST;
