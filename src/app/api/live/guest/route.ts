import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/app-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (isDemoMode()) {
    return NextResponse.json({ error: "Live events disabled in demo mode" }, { status: 404 });
  }

  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  // Guest streams authenticate via the guest session cookie (plan 06).
  // The sessionId param scopes which events pass through — the cookie
  // proves the caller owns that session.
  const { getGuestVenueId } = await import("@/server/guest-auth");
  const venueId = await getGuestVenueId(request);
  if (!venueId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { createEventStream } = await import("@/server/sse");

  const controller = new AbortController();
  const stream = createEventStream({
    venueId,
    scope: "guest",
    sessionId,
    signal: controller.signal,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
