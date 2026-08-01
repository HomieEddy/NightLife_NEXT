import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";


function demoHandler() {
  return NextResponse.json({ error: "Guest routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { listProfiles, searchProfiles } = await import("@/features/guests/core");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const q = request.nextUrl.searchParams.get("q");
  if (q) return NextResponse.json(await searchProfiles(db, q));
  return NextResponse.json(await listProfiles(db));
}

async function livePOST(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { createProfile } = await import("@/features/guests/core");
  const { zCreateProfile } = await import("@/features/guests/schemas");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zCreateProfile.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const profile = await createProfile(db, venueId, parsed.data as Parameters<typeof createProfile>[2]);
  return NextResponse.json(profile, { status: 201 });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
