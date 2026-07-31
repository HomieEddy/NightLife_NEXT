import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Workforce routes are disabled in demo mode" }, { status: 404 });
}

async function livePATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requirePermission } = await import("@/features/platform/permission-guard");
  const { approveTimeOff } = await import("@/features/workforce/time-core");
  const { zApproveTimeOff } = await import("@/features/workforce/workforce-schemas");

  const auth = await requirePermission("staff", "schedule:approve-time-off");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zApproveTimeOff.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { id } = await params;
  const { db } = auth;
  return NextResponse.json(await approveTimeOff(db, id, parsed.data.deciderId, parsed.data.approved));
}

export const PATCH = isDemoMode() ? demoHandler : livePATCH;
