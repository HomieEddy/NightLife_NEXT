import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Door routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { recordExit } = await import("@/features/door/core");
  const { zRecordExit } = await import("@/features/door/schemas");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const { id } = await params;
  const body = await request.json();
  const parsed = zRecordExit.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });

  const result = await recordExit(db, venueId, id, parsed.data.staffId);
  if (!result) return NextResponse.json({ error: "Admission not found" }, { status: 404 });
  return NextResponse.json(result);
}

export const POST = isDemoMode() ? demoHandler : livePOST;
