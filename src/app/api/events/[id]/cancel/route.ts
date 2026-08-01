import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Event routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { cancelEvent } = await import("@/features/hospitality/events-core");
  const { zCancelEvent } = await import("@/features/hospitality/events-schemas");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zCancelEvent.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { id } = await params;
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const event = await cancelEvent(db, id, parsed.data.reason);
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  return NextResponse.json(event);
}

export const POST = isDemoMode() ? demoHandler : livePOST;
