import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Public routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET(_request: NextRequest, { params }: { params: Promise<{ venueSlug: string }> }) {
  const { getDb } = await import("@/features/shared/db");
  const { getPublicAvailability } = await import("@/features/hospitality/reservation-core");

  const { venueSlug } = await params;

  const url = new URL(_request.url);
  const date = url.searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date is required" }, { status: 400 });

  const eventId = url.searchParams.get("eventId") ?? undefined;

  // Public routes are unauthenticated; resolve tenant by slug
  // ponytail: use an unscoped client for public reads — venue scoped by slug
  const { getRawPrisma } = await import("@/features/shared/db");
  const prisma = getRawPrisma();

  // We need a scoped client seeded with the venue resolved by slug
  // Use the venue id from a lookup against the raw prisma
  const venue = await prisma.venue.findFirst({ where: { publicSlug: venueSlug }, select: { id: true } });
  if (!venue) return NextResponse.json(null, { status: 404 });

  const db = getDb({ venueId: venue.id });
  const result = await getPublicAvailability(db, venueSlug, { date, eventId });
  if (!result) return NextResponse.json(null, { status: 404 });

  return NextResponse.json(result);
}

export const GET = isDemoMode() ? demoHandler : liveGET;
