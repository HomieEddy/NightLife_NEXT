import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Floor routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET() {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { listBroadcasts } = await import("@/features/realtime/floor-core");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  return NextResponse.json(await listBroadcasts(db));
}

async function livePOST(request: NextRequest) {
  const { requirePermission } = await import("@/features/platform/permission-guard");
  const { sendBroadcast } = await import("@/features/realtime/floor-core");

  const auth = await requirePermission("staff", "broadcast:send");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId, db } = auth;
  const body = await request.json();
  const message = body.message as string;
  const sentBy = body.sentBy as string;

  if (!message?.trim()) return NextResponse.json({ error: "message required" }, { status: 400 });

  const broadcast = await sendBroadcast(db, venueId, message, sentBy || auth.session.user.name);
  return NextResponse.json(broadcast, { status: 201 });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
