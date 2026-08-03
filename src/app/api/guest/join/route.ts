import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Guest join is disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest) {
  const { getPlatformDb, getDb } = await import("@/features/shared/db");
  const { verifyTableToken } = await import("@/features/shared/table-token");
  const { createSession } = await import("@/features/sessions/core");
  const { zCreateSession } = await import("@/features/sessions/schemas");
  const { checkRateLimit, getClientIp } = await import("@/features/shared/rate-limit");

  const ip = getClientIp(request);
  const body = await request.json();
  const token = body.token as string | undefined;

  // Rate limit: per-IP burst (general abuse).
  const ipRl = checkRateLimit(`guest-join:ip:${ip}`, { maxTokens: 10, refillRate: 10, windowMs: 60_000 });
  if (!ipRl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(ipRl.retryAfterMs / 1000)) } },
    );
  }

  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const parsed = zCreateSession.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const platformDb = getPlatformDb();

  const table = await platformDb.venueTable.findUnique({
    where: { id: parsed.data.tableId },
    include: { zone: true },
  });
  if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 });

  // Verify the token against the actual tokenVersion
  const verified = verifyTableToken(token, (tableId) =>
    tableId === table.id ? table.tokenVersion : null,
  );
  if (!verified.valid) return NextResponse.json({ error: "Invalid or revoked QR code" }, { status: 403 });

  // Per-table burst (QR spam) — keyed on the verified table, so an attacker
  // holding one QR can't burn another table's quota.
  const tableRl = checkRateLimit(`guest-join:table:${table.id}`, { maxTokens: 20, refillRate: 20, windowMs: 300_000 });
  if (!tableRl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(tableRl.retryAfterMs / 1000)) } },
    );
  }

  // Check venue auto-approve setting
  const venue = await platformDb.venue.findUnique({ where: { id: table.venueId } });
  if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 404 });

  const db = getDb({ venueId: table.venueId });
  const session = await createSession(db, table.venueId, parsed.data, venue.autoApproveGuests);

  const response = NextResponse.json(session, { status: 201 });
  response.cookies.set("nln-guest-session", session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12, // 12 hours
  });
  return response;
}

export const POST = isDemoMode() ? demoHandler : livePOST;
