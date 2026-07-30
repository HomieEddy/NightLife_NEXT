import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Guest routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { setBanStatus } = await import("@/features/guests/core");
  const { zSetBanStatus } = await import("@/features/guests/schemas");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zSetBanStatus.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { id } = await params;
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const profile = await setBanStatus(
    db,
    venueId,
    id,
    {
      banned: parsed.data.banned,
      reason: parsed.data.reason,
      bannedUntil: parsed.data.bannedUntil,
    },
    parsed.data.staffId,
    parsed.data.staffName,
  );
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  return NextResponse.json(profile);
}

export const POST = isDemoMode() ? demoHandler : livePOST;
