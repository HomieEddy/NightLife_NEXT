import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Reservation routes are disabled in demo mode" }, { status: 404 });
}

async function livePATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/server/auth-helpers");
  const { getDb, getRawPrisma } = await import("@/server/db");
  const { setReservationStatus } = await import("@/server/reservation-core");
  const { zReservationStatus } = await import("@/server/schemas/reservations");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const parsed = zReservationStatus.safeParse(body.status);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { id } = await params;
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const result = await setReservationStatus(db, venueId, id, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });

  // Plan 25: send confirmation email when a reservation is confirmed and guestEmail exists
  if (parsed.data === "confirmed" && result.reservation?.guestEmail) {
    try {
      await import("@/server/notifications/templates");
      const { dispatch } = await import("@/server/notifications/dispatch");
      const prisma = getRawPrisma();
      const r = result.reservation as unknown as Record<string, unknown>;
      await dispatch(prisma, {
        venueId,
        template: "reservation-confirmation",
        recipients: [{ email: result.reservation.guestEmail }],
        data: {
          venueName: venueId, // ponytail: TODO fetch org name via prisma.organization
          guestName: r.guestName,
          date: new Date(r.startsAt as string).toLocaleDateString("en-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
          time: new Date(r.startsAt as string).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" }),
          partySize: r.partySize,
          reservationPin: r.reservationPin,
        },
        idempotencyKey: `confirm:${id}`,
      });
    } catch (err) {
      console.error("[reservation-confirm] Notification failed:", err);
    }
  }

  return NextResponse.json(result.reservation);
}

export const PATCH = isDemoMode() ? demoHandler : livePATCH;
