import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Session routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { listSessions } = await import("@/features/sessions/core");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const url = new URL(request.url);
  const status = url.searchParams.get("status") as Parameters<typeof listSessions>[1];
  const hostStaffId = url.searchParams.get("hostStaffId");

  if (hostStaffId) {
    // hostStaffId is a live-track column not surfaced in the mock GuestSession type —
    // query Prisma directly so we can filter at the DB level.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { venueId, hostStaffId };
    if (status) where.status = status;
    const rows = await db.guestSession.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
    return NextResponse.json(rows);
  }

  return NextResponse.json(await listSessions(db, status ?? undefined));
}

export const GET = isDemoMode() ? demoHandler : liveGET;
