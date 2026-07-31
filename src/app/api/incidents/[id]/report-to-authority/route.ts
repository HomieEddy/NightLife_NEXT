import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Report-to-authority routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requirePermission } = await import("@/features/platform/permission-guard");
  const { recordReportedToAuthority } = await import("@/features/safety/core");
  const { zRecordReportedToAuthority } = await import("@/features/safety/schemas");

  const auth = await requirePermission("staff", "incident:mark-reportable");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { venueId, db } = auth;

  const { id } = await params;
  const body = await request.json();
  const parsed = zRecordReportedToAuthority.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });

  const incident = await recordReportedToAuthority(db, venueId, id, parsed.data.staffId, parsed.data.staffName);
  if (!incident) return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  return NextResponse.json(incident);
}

export const POST = isDemoMode() ? demoHandler : livePOST;
