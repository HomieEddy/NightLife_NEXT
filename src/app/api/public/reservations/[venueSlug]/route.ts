import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Public routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest, { params }: { params: Promise<{ venueSlug: string }> }) {
  const { getDb } = await import("@/features/shared/db");
  const { getRawPrisma } = await import("@/features/shared/db");
  const { createPublicReservation } = await import("@/features/hospitality/reservation-core");
  const { zPublicReservationInput } = await import("@/features/hospitality/reservation-schemas");

  const { venueSlug } = await params;
  const body = await request.json();
  const parsed = zPublicReservationInput.safeParse({ ...body, venueSlug });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  // Resolve tenant by slug for the public endpoint
  const prisma = getRawPrisma();
  const venue = await prisma.venue.findFirst({ where: { publicSlug: venueSlug }, select: { id: true } });
  if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 404 });

  const db = getDb({ venueId: venue.id });
  const reservation = await createPublicReservation(db, parsed.data);
  return NextResponse.json(reservation, { status: 201 });
}

export const POST = isDemoMode() ? demoHandler : livePOST;
