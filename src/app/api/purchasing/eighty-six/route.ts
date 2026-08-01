import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Purchasing routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET(_request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { listEightySixEntries } = await import("@/features/platform/purchasing-core");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const entries = await listEightySixEntries(db);
  return NextResponse.json(entries);
}

async function livePOST(request: NextRequest) {
  const { requirePermission } = await import("@/features/platform/permission-guard");
  const { eightySixItem } = await import("@/features/platform/purchasing-core");
  const { zEightySix } = await import("@/features/platform/purchasing-schemas");

  const auth = await requirePermission("staff", "inventory:86");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zEightySix.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { db } = auth;
  const entry = await eightySixItem(db, parsed.data.itemId, parsed.data.reason, parsed.data.staffId);
  return NextResponse.json(entry, { status: 201 });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
