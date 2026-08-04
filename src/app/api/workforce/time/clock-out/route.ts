import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";
import { apiErrorFromCatch } from "@/features/shared/api-error";

function demoHandler() {
  return NextResponse.json({ error: "Workforce routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest) {
  const { requirePermission } = await import("@/features/platform/permission-guard");
  const { clockOut } = await import("@/features/workforce/time-core");
  const { zClockOut } = await import("@/features/workforce/workforce-schemas");

  const auth = await requirePermission("staff", "time:clock-self");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zClockOut.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { venueId, db } = auth;
  try {
    const entry = await clockOut(db, venueId, parsed.data.staffId);
    return NextResponse.json(entry);
  } catch (e) {
    return apiErrorFromCatch(e, "Failed to clock out");
  }
}

export const POST = isDemoMode() ? demoHandler : livePOST;
