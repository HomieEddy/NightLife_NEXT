import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Audit routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET(request: NextRequest) {
  const { requirePermission } = await import("@/features/platform/permission-guard");
  const { listAuditEntries } = await import("@/features/tab/core");

  const auth = await requirePermission("staff", "audit:read");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { db } = auth;

  const url = new URL(request.url);
  const filter = {
    ...(url.searchParams.get("actorStaffId") ? { actorStaffId: url.searchParams.get("actorStaffId")! } : {}),
    ...(url.searchParams.get("action") ? { action: url.searchParams.get("action")! } : {}),
    ...(url.searchParams.get("from") ? { from: url.searchParams.get("from")! } : {}),
    ...(url.searchParams.get("to") ? { to: url.searchParams.get("to")! } : {}),
  };

  const entries = await listAuditEntries(db, Object.keys(filter).length ? filter : undefined);
  return NextResponse.json(entries);
}

async function livePOST(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { recordAuditEntry } = await import("@/features/tab/core");
  const { zRecordAudit } = await import("@/features/tab/schemas");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zRecordAudit.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { venueId } = sessionToDbContext(auth.session);
  const entry = await recordAuditEntry(getDb({ venueId }), venueId, parsed.data);
  return NextResponse.json(entry, { status: 201 });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
