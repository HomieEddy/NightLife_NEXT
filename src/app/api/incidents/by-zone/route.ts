import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "By-zone routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET(_request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { getIncidentsByZone } = await import("@/features/safety/core");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const { searchParams } = new URL(_request.url);
  const zoneId = searchParams.get("zoneId");
  if (!zoneId) return NextResponse.json({ error: "Missing zoneId query parameter" }, { status: 400 });

  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  const incidents = await getIncidentsByZone(
    db,
    zoneId,
    from && to ? { from, to } : undefined,
  );
  return NextResponse.json(incidents);
}

export const GET = isDemoMode() ? demoHandler : liveGET;
