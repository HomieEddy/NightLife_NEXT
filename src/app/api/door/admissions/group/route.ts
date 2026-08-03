import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";
import { apiErrorFromCatch } from "@/features/shared/api-error";

function demoHandler() {
  return NextResponse.json({ error: "Door routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest) {
  const { requirePermission } = await import("@/features/platform/permission-guard");
  const { admitGroup } = await import("@/features/door/core");
  const { zAdmitGroup } = await import("@/features/door/schemas");

  const auth = await requirePermission("staff", "door:admit");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zAdmitGroup.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { venueId, db } = auth;

  try {
    const admissions = await admitGroup(db, venueId, parsed.data);
    return NextResponse.json(admissions, { status: 201 });
  } catch (e) {
    return apiErrorFromCatch(e, "Failed to admit group");
  }
}

export const POST = isDemoMode() ? demoHandler : livePOST;
