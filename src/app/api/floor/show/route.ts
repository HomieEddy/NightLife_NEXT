import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Floor routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET() {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { getActiveShow } = await import("@/features/realtime/floor-core");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  return NextResponse.json(await getActiveShow(db));
}

async function livePOST(request: NextRequest) {
  const { requirePermission } = await import("@/features/platform/permission-guard");
  const { startShow, finishShow } = await import("@/features/realtime/floor-core");

  // show:control claims the floor's single presentation slot — manager/host/bartender.
  // A runner or security token must not be able to lock or release the show.
  const auth = await requirePermission("staff", "show:control");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId, staff } = auth;
  const body = await request.json();
  const action = body.action as "start" | "finish";

  if (action === "start") {
    const result = await startShow(
      venueId,
      body.orderId,
      body.tableCode,
      body.zoneName,
      body.label,
      staff.name,
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
