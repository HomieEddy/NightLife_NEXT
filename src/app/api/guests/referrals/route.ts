import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Guest routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { listReferrals } = await import("@/features/guests/core");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const profileId = request.nextUrl.searchParams.get("profileId") ?? undefined;
  return NextResponse.json(await listReferrals(db, profileId));
}

async function livePOST(request: NextRequest) {
  const { requirePermission } = await import("@/features/platform/permission-guard");
  const { createReferral } = await import("@/features/guests/core");
  const { zCreateReferral } = await import("@/features/guests/schemas");

  // guest:manage-referral is manager/host CRM work — a runner or security
  // token must not mutate a guest's referral relationship.
  const auth = await requirePermission("staff", "guest:manage-referral");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zCreateReferral.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { venueId, db } = auth;
  const referral = await createReferral(db, venueId, parsed.data);
  return NextResponse.json(referral, { status: 201 });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
