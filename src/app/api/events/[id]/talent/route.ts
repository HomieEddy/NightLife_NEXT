import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Event routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { listEventTalent } = await import("@/features/hospitality/events-core");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  return NextResponse.json(await listEventTalent(db, id));
}

async function livePOST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { createTalent } = await import("@/features/hospitality/events-core");
  const { zTalentInput } = await import("@/features/hospitality/events-schemas");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await request.json();
  const parsed = zTalentInput.safeParse({ ...body, eventId: id });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const talent = await createTalent(db, venueId, parsed.data);
  return NextResponse.json(talent, { status: 201 });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
