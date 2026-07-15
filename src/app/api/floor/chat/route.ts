import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Floor routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/server/auth-helpers");
  const { getDb } = await import("@/server/db");
  const { listMessages } = await import("@/server/floor-core");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const channel = request.nextUrl.searchParams.get("channel") as "floor" | "bar" | "security";
  if (!channel || !["floor", "bar", "security"].includes(channel)) {
    return NextResponse.json({ error: "channel must be floor, bar, or security" }, { status: 400 });
  }

  return NextResponse.json(await listMessages(db, channel));
}

async function livePOST(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/server/auth-helpers");
  const { getDb } = await import("@/server/db");
  const { sendMessage } = await import("@/server/floor-core");
  const { getRawPrisma } = await import("@/server/db");
  const { getCurrentStaff } = await import("@/server/staff-core");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const body = await request.json();

  if (!body.channel || !body.body) {
    return NextResponse.json({ error: "channel and body required" }, { status: 400 });
  }

  const staff = await getCurrentStaff(getRawPrisma(), venueId, auth.session.user.id);
  if (!staff) return NextResponse.json({ error: "Staff profile not found" }, { status: 403 });
  const msg = await sendMessage(db, venueId, {
    channel: body.channel,
    authorId: staff.id,
    authorName: staff.name,
    authorRole: staff.role,
    body: body.body,
  });

  return NextResponse.json(msg, { status: 201 });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
