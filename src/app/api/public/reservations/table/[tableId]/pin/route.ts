import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Public routes are disabled in demo mode" }, { status: 404 });
}

/**
 * Public — the guest submits the reservation PIN from the QR landing, before
 * any session exists. A staff guard here makes the gate impossible to clear.
 *
 * A 6-digit PIN is only ~1M combinations, so the bucket is per table+IP and
 * deliberately tight: the client already caps itself at 3 attempts, and this
 * is the server-side half of that promise.
 */
async function livePOST(request: NextRequest, { params }: { params: Promise<{ tableId: string }> }) {
  const { getDb, getRawPrisma } = await import("@/features/shared/db");
  const { validatePinAndSeat } = await import("@/features/hospitality/reservation-core");
  const { zValidatePinInput } = await import("@/features/hospitality/reservation-schemas");
  const { checkRateLimit, getClientIp } = await import("@/features/shared/rate-limit");

  const { tableId } = await params;

  const ip = getClientIp(request);

  const rl = checkRateLimit(`resv-pin:${tableId}:${ip}`, {
    maxTokens: 5,
    refillRate: 5,
    windowMs: 300_000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Ask venue staff for help." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = zValidatePinInput.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  // Resolve the tenant from the table itself — there is no session to read it from.
  const table = await getRawPrisma().venueTable.findUnique({
    where: { id: tableId },
    select: { venueId: true },
  });
  if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 });

  const db = getDb({ venueId: table.venueId });
  const result = await validatePinAndSeat(db, tableId, parsed.data.pin);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 403 });
  return NextResponse.json({ ok: true });
}

export const POST = isDemoMode() ? demoHandler : livePOST;
