import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Reservation routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { listReservations } = await import("@/features/hospitality/reservation-core");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const url = new URL(request.url);
  const status = url.searchParams.getAll("status");
  const zoneIds = url.searchParams.getAll("zoneId");
  const date = url.searchParams.get("date") ?? undefined;
  const promoterId = url.searchParams.get("promoterId") ?? undefined;

  return NextResponse.json(
    await listReservations(db, venueId, {
      status: status.length ? status as never[] : undefined,
      zoneIds: zoneIds.length ? zoneIds : undefined,
      date,
      promoterId,
    }),
  );
}

async function livePOST(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { createReservation } = await import("@/features/hospitality/reservation-core");
  const { zReservationInput } = await import("@/features/hospitality/reservation-schemas");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zReservationInput.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const reservation = await createReservation(db, venueId, parsed.data);
  return NextResponse.json(reservation, { status: 201 });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
