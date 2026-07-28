import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Event routes are disabled in demo mode" }, { status: 404 });
}

async function liveDELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; guestId: string }> },
) {
  const { requireApiArea, sessionToDbContext } = await import("@/server/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { removeEventGuest } = await import("@/server/events-core");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { guestId } = await params;
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  await removeEventGuest(db, guestId);
  return NextResponse.json({ ok: true });
}

export const DELETE = isDemoMode() ? demoHandler : liveDELETE;
