import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Report routes are disabled in demo mode" }, { status: 404 });
}

type RouteContext = { params: Promise<{ id: string }> };

async function livePATCH(request: NextRequest, context: RouteContext) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { updateReport } = await import("@/features/analytics/report-core");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await context.params;
  const body = await request.json();
  const { venueId } = sessionToDbContext(auth.session);
  const result = await updateReport(getDb({ venueId }), id, body);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(result);
}

async function liveDELETE(_request: NextRequest, context: RouteContext) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { deleteReport } = await import("@/features/analytics/report-core");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await context.params;
  const { venueId } = sessionToDbContext(auth.session);
  await deleteReport(getDb({ venueId }), id);
  return NextResponse.json({ ok: true });
}

export const PATCH = isDemoMode() ? demoHandler : livePATCH;
export const DELETE = isDemoMode() ? demoHandler : liveDELETE;
