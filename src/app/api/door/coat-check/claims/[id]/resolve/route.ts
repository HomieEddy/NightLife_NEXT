import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Door routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requirePermission } = await import("@/features/platform/permission-guard");
  const { resolveClaim } = await import("@/features/door/core");
  const { zResolveClaim } = await import("@/features/door/schemas");

  const auth = await requirePermission("staff", "door:coat-check");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { venueId, db } = auth;

  const { id } = await params;
  const parsed = zResolveClaim.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const claim = await resolveClaim(db, id, parsed.data.resolution, parsed.data.staffId);
  if (!claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  return NextResponse.json(claim);
}

export const POST = isDemoMode() ? demoHandler : livePOST;
