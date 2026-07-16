import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Guest join is disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest) {
  const { getPlatformDb, getDb } = await import("@/server/db");
  const { verifyTableToken } = await import("@/server/table-token");
  const { createSession } = await import("@/server/session-core");
  const { zCreateSession } = await import("@/server/schemas/sessions");

  const body = await request.json();
  const token = body.token as string | undefined;
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
