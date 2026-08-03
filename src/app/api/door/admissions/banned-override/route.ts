import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";
import { logger } from "@/features/shared/logger";

function demoHandler() {
  return NextResponse.json({ error: "Door routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest) {
  const { requirePermission } = await import("@/features/platform/permission-guard");
  const { createBannedOverride } = await import("@/features/door/core");
  const { zAdmitBannedOverride } = await import("@/features/door/schemas");

  const auth = await requirePermission("staff", "door:admit-banned-override");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zAdmitBannedOverride.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { venueId, db } = auth;

  try {
    const admission = await createBannedOverride(db, venueId, parsed.data);
    return NextResponse.json(admission, { status: 201 });
  } catch (e) {
    logger.error("Failed to create banned override", { error: String(e) });
    return NextResponse.json({ error: "Operation failed" }, { status: 403 });
  }
}

export const POST = isDemoMode() ? demoHandler : livePOST;
