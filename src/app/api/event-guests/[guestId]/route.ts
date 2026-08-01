import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Event routes are disabled in demo mode" }, { status: 404 });
}

async function liveDELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ guestId: string }> },
) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { removeEventGuest } = await import("@/features/hospitality/events-core");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { guestId } = await params;
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  await removeEventGuest(db, guestId);
  return NextResponse.json({ ok: true });
}

async function livePATCH(
  request: NextRequest,
  { params }: { params: Promise<{ guestId: string }> },
) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { z } = await import("zod");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = z.object({ status: z.string().min(1) }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { guestId } = await params;
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  // EventGuest has no venueId — verify via the parent event's venue
  const guest = await db.eventGuest.findUnique({
    where: { id: guestId },
    include: { event: { select: { venueId: true } } },
  });
  if (!guest) return NextResponse.json({ error: "Event guest not found" }, { status: 404 });
  if (guest.event.venueId !== venueId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await db.eventGuest.update({
    where: { id: guestId },
    data: { status: parsed.data.status },
  });
  return NextResponse.json(updated);
}

export const PATCH = isDemoMode() ? demoHandler : livePATCH;
export const DELETE = isDemoMode() ? demoHandler : liveDELETE;
