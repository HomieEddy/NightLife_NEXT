import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Guest help routes are disabled in demo mode" }, { status: 404 });
}

function getGuestSessionId(request: NextRequest): string | null {
  return request.cookies.get("nln-guest-session")?.value ?? null;
}

async function livePOST(request: NextRequest) {
  const sessionId = getGuestSessionId(request);
  if (!sessionId) return NextResponse.json({ error: "No guest session" }, { status: 401 });

  const { getPlatformDb, getDb } = await import("@/features/shared/db");
  const { createHelpRequest } = await import("@/features/sessions/core");
  const { zCreateHelpRequest } = await import("@/features/sessions/schemas");

  const platformDb = getPlatformDb();
  const row = await platformDb.guestSession.findUnique({ where: { id: sessionId } });
  if (!row) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  if (row.status !== "approved") {
    return NextResponse.json({ error: "Session not approved" }, { status: 403 });
  }

  const parsed = zCreateHelpRequest.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const db = getDb({ venueId: row.venueId });
  const helpRequest = await createHelpRequest(db, row.venueId, parsed.data);
  return NextResponse.json(helpRequest, { status: 201 });
}

export const POST = isDemoMode() ? demoHandler : livePOST;
