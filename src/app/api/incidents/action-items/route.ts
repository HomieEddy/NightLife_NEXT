import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Action-item routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET(_request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { listActionItems } = await import("@/features/safety/core");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const { searchParams } = new URL(_request.url);
  const incidentId = searchParams.get("incidentId") ?? undefined;

  const items = await listActionItems(db, incidentId);
  return NextResponse.json(items);
}

async function livePOST(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { createActionItem } = await import("@/features/safety/core");
  const { zCreateActionItem } = await import("@/features/safety/schemas");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const body = await request.json();
  const parsed = zCreateActionItem.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });

  const item = await createActionItem(db, venueId, parsed.data);
  return NextResponse.json(item, { status: 201 });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
