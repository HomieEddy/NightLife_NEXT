import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Door routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requirePermission } = await import("@/features/platform/permission-guard");
  const { claimCoat } = await import("@/features/door/core");

  const auth = await requirePermission("staff", "door:coat-check");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { venueId, db } = auth;

  const { id } = await params;
  const ticket = await claimCoat(db, id);
  if (!ticket) return NextResponse.json({ error: "Coat check ticket not found" }, { status: 404 });
  return NextResponse.json(ticket);
}

export const POST = isDemoMode() ? demoHandler : livePOST;
