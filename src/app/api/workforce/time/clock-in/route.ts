import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Workforce routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest) {
  const { requirePermission } = await import("@/features/platform/permission-guard");
  const { clockIn } = await import("@/features/workforce/time-core");
  const { zClockIn } = await import("@/features/workforce/workforce-schemas");

  const auth = await requirePermission("staff", "time:clock-self");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zClockIn.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { venueId, db } = auth;
  try {
    const entry = await clockIn(db, venueId, parsed.data.staffId, parsed.data.shiftId);
    return NextResponse.json(entry, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}

export const POST = isDemoMode() ? demoHandler : livePOST;
