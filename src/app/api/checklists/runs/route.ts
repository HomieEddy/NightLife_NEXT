import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Checklist routes are not available in demo mode" }, { status: 404 });
}

async function liveGET(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { listRuns } = await import("@/features/venue/checklist-core");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const type = request.nextUrl.searchParams.get("type") as "opening" | "closing" | null;
  const businessDate = request.nextUrl.searchParams.get("businessDate") ?? undefined;
  const runs = await listRuns(db, {
    type: type ?? undefined,
    businessDate,
  });
  return NextResponse.json(runs);
}

async function livePOST(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { startRun } = await import("@/features/venue/checklist-core");
  const { zStartRun } = await import("@/features/venue/checklist-schemas");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zStartRun.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const run = await startRun(db, parsed.data);
  if (!run) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  return NextResponse.json(run, { status: 201 });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
