import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Guest routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const guestProfileId = request.nextUrl.searchParams.get("guestProfileId");
  const top = request.nextUrl.searchParams.get("top");

  if (guestProfileId) {
    const profile = await db.guestProfile.findUnique({ where: { id: guestProfileId } });
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    return NextResponse.json({
      profiles: [{
        id: profile.id,
        displayName: profile.displayName,
        lifetimeNetCents: profile.lifetimeNetCents,
        visitCount: profile.visitCount,
      }],
    });
  }

  if (top) {
    const rows = await db.guestProfile.findMany({
      orderBy: { lifetimeNetCents: "desc" },
      take: 20,
    });
    return NextResponse.json({
      profiles: rows.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        lifetimeNetCents: p.lifetimeNetCents,
        visitCount: p.visitCount,
      })),
    });
  }

  return NextResponse.json({ profiles: [] });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
