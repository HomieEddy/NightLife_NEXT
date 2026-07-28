import { NextResponse } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (isDemoMode()) {
    return NextResponse.json({ error: "Live events disabled in demo mode" }, { status: 404 });
  }

  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const { createEventStream } = await import("@/features/realtime/sse");

  const controller = new AbortController();
  const stream = createEventStream({
    venueId,
    scope: "manager",
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
