import { NextResponse } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Staff routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET() {
  const { requireApiArea, sessionToDbContext } = await import("@/server/auth-helpers");
  const { getRawPrisma } = await import("@/features/shared/db");
  const { getCurrentStaff } = await import("@/server/staff-core");
  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const member = await getCurrentStaff(getRawPrisma(), sessionToDbContext(auth.session).venueId, auth.session.user.id);
  if (!member) return NextResponse.json({ error: "Staff profile not found" }, { status: 404 });
  return NextResponse.json(member);
}

export const GET = isDemoMode() ? demoHandler : liveGET;
