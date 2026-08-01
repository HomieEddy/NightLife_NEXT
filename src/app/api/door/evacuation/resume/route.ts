import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Door routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest) {
  const { requirePermission } = await import("@/features/platform/permission-guard");
  const { resumeEvacuation } = await import("@/features/door/core");
  const { zResumeEvacuation } = await import("@/features/door/schemas");

  const auth = await requirePermission("staff", "emergency:resume");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { venueId, db } = auth;

  const parsed = zResumeEvacuation.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  try {
    await resumeEvacuation(db, venueId, parsed.data.staffId, parsed.data.staffName);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
}

export const POST = isDemoMode() ? demoHandler : livePOST;
