import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Staff routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getRawPrisma } = await import("@/features/shared/db");
  const { toggleShift } = await import("@/features/workforce/staff-core");
  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const member = await toggleShift(getRawPrisma(), sessionToDbContext(auth.session).venueId, id);
  if (!member) return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
  return NextResponse.json(member);
}

export const POST = isDemoMode() ? demoHandler : livePOST;
