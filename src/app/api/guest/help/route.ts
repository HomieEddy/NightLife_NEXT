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
  const { checkRateLimit, getClientIp } = await import("@/features/shared/rate-limit");

  // Rate limit: per-session (tight — guest help is abusable) + per-IP fallback.
  const sessionRl = checkRateLimit(`guest-help:session:${sessionId}`, { maxTokens: 3, refillRate: 3, windowMs: 60_000 });
  if (!sessionRl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(sessionRl.retryAfterMs / 1000)) } },
    );
  }
  const ip = getClientIp(request);
  const ipRl = checkRateLimit(`guest-help:ip:${ip}`, { maxTokens: 10, refillRate: 10, windowMs: 60_000 });
  if (!ipRl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(ipRl.retryAfterMs / 1000)) } },
    );
  }

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
