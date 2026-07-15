import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Floor routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET(request: NextRequest) {
  const { getGuestAccess } = await import("@/server/guest-auth");
  const { requireApiArea, sessionToDbContext } = await import("@/server/auth-helpers");
  const { getDb } = await import("@/server/db");
  const { getLastCallState } = await import("@/server/floor-core");

  const guest = await getGuestAccess(request);
  const auth = guest ? null : await requireApiArea("staff");
  if (auth && "error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const venueId = guest?.venueId ?? sessionToDbContext(auth!.session).venueId;
  const db = getDb({ venueId });
  return NextResponse.json(await getLastCallState(db, venueId));
}

async function livePOST(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/server/auth-helpers");
  const { getDb } = await import("@/server/db");
  const { startLastCall, endLastCall } = await import("@/server/floor-core");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const body = await request.json();
  const action = body.action as "start" | "end";

  if (action === "start") {
    await startLastCall(db, venueId, body.sentBy || auth.session.user.name);
  } else if (action === "end") {
    await endLastCall(db, venueId);
  } else {
    return NextResponse.json({ error: "action must be 'start' or 'end'" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
