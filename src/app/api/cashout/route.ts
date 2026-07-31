import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Cashout routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { listCashouts } = await import("@/features/tab/core");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const url = new URL(request.url);
  const staffId = url.searchParams.get("staffId") ?? undefined;

  const cashouts = await listCashouts(db, staffId);
  return NextResponse.json(cashouts);
}

async function livePOST(request: NextRequest) {
  const { requirePermission } = await import("@/features/platform/permission-guard");
  const { closeCashout } = await import("@/features/tab/core");
  const { getVenue } = await import("@/features/venue/core");
  const { zCloseCashout } = await import("@/features/tab/schemas");

  const auth = await requirePermission("staff", "cashout:close");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zCloseCashout.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { venueId, db } = auth;
  const venue = await getVenue(db, venueId);
  const nightEndHour = venue?.nightEndHour ?? 6;

  const result = await closeCashout(db, venueId, nightEndHour, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json(result.cashout, { status: 201 });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
