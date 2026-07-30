import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Tab routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { listAdjustments } = await import("@/features/tab/core");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId") ?? undefined;

  const adjustments = await listAdjustments(db, sessionId);
  return NextResponse.json(adjustments);
}

async function livePOST(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { createAdjustment } = await import("@/features/tab/core");
  const { zAdjustOrder } = await import("@/features/tab/schemas");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zAdjustOrder.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { venueId } = sessionToDbContext(auth.session);
  const result = await createAdjustment(getDb({ venueId }), venueId, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json(result.adjustment, { status: 201 });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
