import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";
import type { GuestTag, GuestVipTier } from "@/lib/types";

function demoHandler() {
  return NextResponse.json({ error: "Guest routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { requirePermission } = await import("@/features/platform/permission-guard");
  const { getProfile } = await import("@/features/guests/core");

  const auth = await requirePermission("staff", "guest:read-profile");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { db } = auth;

  const { id } = await params;
  const profile = await getProfile(db, id);
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  return NextResponse.json(profile);
}

async function livePATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { requirePermission } = await import("@/features/platform/permission-guard");
  const { updateProfile } = await import("@/features/guests/core");
  const { zUpdateProfile } = await import("@/features/guests/schemas");

  const auth = await requirePermission("staff", "guest:edit-profile");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zUpdateProfile.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { id } = await params;
  const { venueId, db } = auth;
  const profile = await updateProfile(
    db,
    venueId,
    id,
    {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      phone: parsed.data.phone,
      email: parsed.data.email,
      dobYear: parsed.data.dobYear,
      tags: parsed.data.tags as GuestTag[] | undefined,
      vipTier: parsed.data.vipTier as GuestVipTier | undefined,
      notes: parsed.data.notes,
      photoUrl: parsed.data.photoUrl,
      preferences: parsed.data.preferences,
    },
    parsed.data.staffId,
    parsed.data.staffName,
  );
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  return NextResponse.json(profile);
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const PATCH = isDemoMode() ? demoHandler : livePATCH;
