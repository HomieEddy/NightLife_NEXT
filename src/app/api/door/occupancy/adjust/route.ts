import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Door routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest) {
  const { requirePermission } = await import("@/features/platform/permission-guard");
  const { adjustOccupancy } = await import("@/features/door/core");
  const { zAdjustOccupancy } = await import("@/features/door/schemas");

  const auth = await requirePermission("staff", "door:count");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { venueId, db } = auth;

  const body = await request.json();
  const parsed = zAdjustOccupancy.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });

  const result = await adjustOccupancy(db, venueId, parsed.data);
  return NextResponse.json(result);
}

export const POST = isDemoMode() ? demoHandler : livePOST;
