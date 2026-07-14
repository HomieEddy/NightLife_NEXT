import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Analytics routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/server/auth-helpers");
  const { getDb } = await import("@/server/db");
  const { getSummaryForVenue, getHistoricalForVenue } = await import("@/server/analytics-core");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  if (from && to) {
    const data = await getHistoricalForVenue(db, from, to);
    return NextResponse.json(data);
  }

  const { getRawPrisma } = await import("@/server/db");
  const venue = await getRawPrisma().venue.findUnique({ where: { id: venueId }, select: { timezone: true } });
  const timezone = venue?.timezone ?? "UTC";

  const summary = await getSummaryForVenue(db, venueId, timezone);
  return NextResponse.json(summary);
}

export const GET = isDemoMode() ? demoHandler : liveGET;
