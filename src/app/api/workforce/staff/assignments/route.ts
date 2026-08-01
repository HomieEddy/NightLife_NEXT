import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Workforce routes are disabled in demo mode" }, { status: 404 });
}

// GET — list assignments by staffId or tableId query param
async function liveGET(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { getTableAssignment, getAssignedStaff } = await import("@/features/workforce/assignment-core");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const staffId = request.nextUrl.searchParams.get("staffId");
  const tableId = request.nextUrl.searchParams.get("tableId");

  if (staffId) {
    const assignment = await getTableAssignment(db, venueId, staffId);
    return NextResponse.json(assignment);
  }
  if (tableId) {
    const assignments = await getAssignedStaff(db, venueId, tableId);
    return NextResponse.json(assignments);
  }
  return NextResponse.json({ error: "Provide staffId or tableId query param" }, { status: 400 });
}

// POST — assign tables to a staff member
async function livePOST(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { assignTables } = await import("@/features/workforce/assignment-core");
  const { zAssignTables } = await import("@/features/workforce/workforce-schemas");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zAssignTables.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const assignment = await assignTables(
    db, venueId, parsed.data.staffId, parsed.data.tableIds, parsed.data.zoneId, parsed.data.shiftId,
  );
  return NextResponse.json(assignment, { status: 201 });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
