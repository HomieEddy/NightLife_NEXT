import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Workforce routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest) {
  const { requirePermission } = await import("@/features/platform/permission-guard");
  const { publishShifts } = await import("@/features/workforce/time-core");
  const { zPublishShifts } = await import("@/features/workforce/workforce-schemas");

  const auth = await requirePermission("staff", "schedule:publish");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zPublishShifts.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { db } = auth;
  return NextResponse.json(await publishShifts(db, parsed.data.shiftIds));
}

export const POST = isDemoMode() ? demoHandler : livePOST;
