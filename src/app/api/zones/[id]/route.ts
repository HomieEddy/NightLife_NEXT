import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Zone routes are disabled in demo mode" }, { status: 404 });
}

async function livePATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { updateZone } = await import("@/features/venue/core");
  const { zZonePatch } = await import("@/features/venue/schemas");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zZonePatch.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { id } = await params;
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const zone = await updateZone(db, id, parsed.data);
  if (!zone) return NextResponse.json({ error: "Zone not found" }, { status: 404 });
  return NextResponse.json(zone);
}

async function liveDELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { deleteZone } = await import("@/features/venue/core");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const result = await deleteZone(db, id);
  return NextResponse.json(result);
}

export const PATCH = isDemoMode() ? demoHandler : livePATCH;
export const DELETE = isDemoMode() ? demoHandler : liveDELETE;
