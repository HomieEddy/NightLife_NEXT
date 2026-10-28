import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Door routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET(_request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { listCoatCheckTickets } = await import("@/features/door/core");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const tickets = await listCoatCheckTickets(db, venueId);
  return NextResponse.json(tickets);
}

async function livePOST(request: NextRequest) {
  const { requirePermission } = await import("@/features/platform/permission-guard");
  const { checkInCoat } = await import("@/features/door/core");
  const { zCheckInCoat } = await import("@/features/door/schemas");

  // door:coat-check is a door-operator function (manager/security) — a runner
  // or promoter token must not check coats in or out.
  const auth = await requirePermission("staff", "door:coat-check");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zCheckInCoat.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { venueId, db } = auth;
  const ticket = await checkInCoat(db, venueId, parsed.data);
  return NextResponse.json(ticket, { status: 201 });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
