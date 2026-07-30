import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Reservation routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { bumpReservation } = await import("@/features/hospitality/reservation-core");
  const { zBumpInput } = await import("@/features/hospitality/reservation-schemas");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zBumpInput.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { id } = await params;
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const reservation = await bumpReservation(db, venueId, id, parsed.data);
  return NextResponse.json(reservation);
}

export const POST = isDemoMode() ? demoHandler : livePOST;
