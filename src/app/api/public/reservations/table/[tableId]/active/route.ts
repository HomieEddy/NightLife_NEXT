import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Public routes are disabled in demo mode" }, { status: 404 });
}

/**
 * Public — the guest QR landing calls this before any session exists, to learn
 * whether the table is PIN-gated. A staff guard here 401s every scanning guest,
 * which the QR page reads as "table not found".
 *
 * Unauthenticated and keyed only by tableId, so the response is redacted to
 * what the gate needs: the PIN and the booker's contact details never cross
 * this boundary.
 */
async function liveGET(_request: NextRequest, { params }: { params: Promise<{ tableId: string }> }) {
  const { getDb, getRawPrisma } = await import("@/features/shared/db");
  const { getActiveReservationForTable } = await import("@/features/hospitality/reservation-core");
  const { checkRateLimit, getClientIp } = await import("@/features/shared/rate-limit");
  const { apiRateLimitError } = await import("@/features/shared/api-error");

  const { tableId } = await params;

  // Rate limit: per-table+IP to prevent brute-force scanning.
  const ip = getClientIp(_request);
  const rl = checkRateLimit(`resv-active:${tableId}:${ip}`, { maxTokens: 10, refillRate: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    return apiRateLimitError(rl.retryAfterMs);
  }

  // Resolve the tenant from the table itself — there is no session to read it from.
  const table = await getRawPrisma().venueTable.findUnique({
    where: { id: tableId },
    select: { venueId: true },
  });
  if (!table) return NextResponse.json(null, { status: 404 });

  const db = getDb({ venueId: table.venueId });
  const reservation = await getActiveReservationForTable(db, tableId);
  if (!reservation) return NextResponse.json(null, { status: 404 });

  const { reservationPin: _pin, guestEmail: _email, guestPhone: _phone, ...safe } = reservation;
  return NextResponse.json(safe);
}

export const GET = isDemoMode() ? demoHandler : liveGET;
