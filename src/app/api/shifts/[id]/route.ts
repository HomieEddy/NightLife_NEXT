import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Shift routes are disabled in demo mode" }, { status: 404 });
}

async function liveDELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { removeShift } = await import("@/features/workforce/shift-core");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  await removeShift(db, id);
  return NextResponse.json({ ok: true });
}

export const DELETE = isDemoMode() ? demoHandler : liveDELETE;
