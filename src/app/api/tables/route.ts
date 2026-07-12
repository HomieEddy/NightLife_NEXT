import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Table routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/server/auth-helpers");
  const { getDb } = await import("@/server/db");
  const { listTables } = await import("@/server/venue-core");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const zoneId = request.nextUrl.searchParams.get("zoneId") ?? undefined;
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  return NextResponse.json(await listTables(db, zoneId));
}

async function livePOST(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/server/auth-helpers");
  const { getDb } = await import("@/server/db");
  const { createTable } = await import("@/server/venue-core");
  const { zTableInput } = await import("@/server/schemas/venue");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zTableInput.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const table = await createTable(db, venueId, parsed.data);
  return NextResponse.json(table, { status: 201 });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
