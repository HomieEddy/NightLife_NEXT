import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Incident routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET(_request: NextRequest) {
  const { requireStaffContext } = await import("@/features/platform/permission-guard");
  const { canDo } = await import("@/features/shared/permissions");
  const { listIncidents } = await import("@/features/safety/core");

  const auth = await requireStaffContext("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { db, staff, permissions } = auth;

  const { searchParams } = new URL(_request.url);
  const filter: Record<string, unknown> = {};
  if (searchParams.get("type")) filter.type = searchParams.get("type");
  if (searchParams.get("severity")) filter.severity = searchParams.get("severity");
  if (searchParams.get("status")) filter.status = searchParams.get("status");
  // Without incident:read-all a caller may only see incidents they reported —
  // force the scope server-side rather than trusting the query param.
  if (canDo(permissions, staff.role, "incident:read-all")) {
    if (searchParams.get("reportedByStaffId")) filter.reportedByStaffId = searchParams.get("reportedByStaffId");
  } else {
    filter.reportedByStaffId = staff.id;
  }

  const incidents = await listIncidents(db, Object.keys(filter).length ? filter : undefined);
  return NextResponse.json(incidents);
}

async function livePOST(request: NextRequest) {
  const { requirePermission } = await import("@/features/platform/permission-guard");
  const { reportIncident } = await import("@/features/safety/core");
  const { zReportIncident } = await import("@/features/safety/schemas");

  const auth = await requirePermission("staff", "incident:create");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { venueId, db } = auth;

  const body = await request.json();
  const parsed = zReportIncident.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });

  const incident = await reportIncident(db, venueId, parsed.data as Parameters<typeof reportIncident>[2]);
  return NextResponse.json(incident, { status: 201 });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
