import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Venue routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET() {
  const { requireApiArea, sessionToDbContext } = await import("@/server/auth-helpers");
  const { getDb } = await import("@/server/db");
  const { getVenue } = await import("@/server/venue-core");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const venue = await getVenue(db, venueId);
  if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 404 });
  return NextResponse.json(venue);
}

async function livePATCH(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/server/auth-helpers");
  const { getDb } = await import("@/server/db");
  const { updateVenue } = await import("@/server/venue-core");
  const { zVenuePatch } = await import("@/server/schemas/venue");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zVenuePatch.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const venue = await updateVenue(db, venueId, parsed.data);
  return NextResponse.json(venue);
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const PATCH = isDemoMode() ? demoHandler : livePATCH;
