import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Waitlist routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET(_request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const entries = await db.waitlistEntry.findMany({ where: { venueId }, orderBy: { joinedAt: "asc" }, take: 200 });
  return NextResponse.json(entries);
}

async function livePOST(request: NextRequest) {
  const { requirePermission } = await import("@/features/platform/permission-guard");

  // waitlist:manage is manager/security — a runner or bartender cannot admit
  // a walk-in to the list.
  const auth = await requirePermission("staff", "waitlist:manage");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { venueId, db } = auth;

  const body = await request.json();
  const entry = await db.waitlistEntry.create({
    data: {
      venueId,
      name: body.name,
      partySize: body.partySize,
      phone: body.phone ?? null,
      quotedMinutes: body.quotedMinutes ?? 30,
      status: "waiting",
      joinedAt: new Date(),
    },
  });
  return NextResponse.json(entry, { status: 201 });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
