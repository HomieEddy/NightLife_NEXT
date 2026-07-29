import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Guest session routes are disabled in demo mode" }, { status: 404 });
}

function getGuestSessionId(request: NextRequest): string | null {
  return request.cookies.get("nln-guest-session")?.value ?? null;
}

async function liveGET(request: NextRequest) {
  const sessionId = getGuestSessionId(request);
  if (!sessionId) return NextResponse.json({ error: "No guest session" }, { status: 401 });

  const { getPlatformDb, getDb } = await import("@/features/shared/db");
  const { getSession } = await import("@/features/sessions/core");

  const platformDb = getPlatformDb();
  const row = await platformDb.guestSession.findUnique({ where: { id: sessionId } });
  if (!row) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const db = getDb({ venueId: row.venueId });
  const session = await getSession(db, sessionId);
  return NextResponse.json(session);
}

async function livePOST(request: NextRequest) {
  const sessionId = getGuestSessionId(request);
  if (!sessionId) return NextResponse.json({ error: "No guest session" }, { status: 401 });

  const { getPlatformDb, getDb } = await import("@/features/shared/db");
  const { requestClosure } = await import("@/features/sessions/core");

  const platformDb = getPlatformDb();
  const row = await platformDb.guestSession.findUnique({ where: { id: sessionId } });
  if (!row) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const db = getDb({ venueId: row.venueId });
  const result = await requestClosure(db, sessionId);

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json(result.session);
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
