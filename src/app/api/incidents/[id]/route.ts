import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Incident routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { getIncident } = await import("@/features/safety/core");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const { id } = await params;
  const incident = await getIncident(db, id);
  if (!incident) return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  return NextResponse.json(incident);
}

async function livePATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireStaffContext } = await import("@/features/platform/permission-guard");
  const { canDo } = await import("@/features/shared/permissions");
  const { setIncidentStatus, markReportable } = await import("@/features/safety/core");

  const auth = await requireStaffContext("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { venueId, db, staff, permissions } = auth;

  const { id } = await params;
  const body = await request.json();

  if (body.reportable !== undefined) {
    if (!canDo(permissions, staff.role, "incident:mark-reportable")) {
      return NextResponse.json(
        { error: `Role ${staff.role} cannot mark incidents reportable` },
        { status: 403 },
      );
    }
    const incident = await markReportable(db, venueId, id, {
      regulatoryDeadline: body.regulatoryDeadline,
      regulatoryAuthority: body.regulatoryAuthority,
      staffId: body.staffId,
      staffName: body.staffName,
    });
    if (!incident) return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    return NextResponse.json(incident);
  }

  if (body.status) {
    const incident = await setIncidentStatus(db, id, body.status);
    if (!incident) return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    return NextResponse.json(incident);
  }

  return NextResponse.json({ error: "Invalid patch body" }, { status: 400 });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const PATCH = isDemoMode() ? demoHandler : livePATCH;
