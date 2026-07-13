import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Floor routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET() {
  const { requireApiArea, sessionToDbContext } = await import("@/server/auth-helpers");
  const { getDb } = await import("@/server/db");
  const { getActiveShow } = await import("@/server/floor-core");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  return NextResponse.json(await getActiveShow(db));
}

async function livePOST(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/server/auth-helpers");
  const { startShow, finishShow } = await import("@/server/floor-core");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const body = await request.json();
  const action = body.action as "start" | "finish";

  if (action === "start") {
    const result = await startShow(
      venueId,
      body.orderId,
      body.tableCode,
      body.zoneName,
      body.label,
      body.staffName,
    );
    return NextResponse.json(result);
  } else if (action === "finish") {
    await finishShow(venueId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "action must be 'start' or 'finish'" }, { status: 400 });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
