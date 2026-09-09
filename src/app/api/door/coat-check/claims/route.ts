import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Door routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest) {
  const { requirePermission } = await import("@/features/platform/permission-guard");
  const { reportLostTicket, reportLostItem } = await import("@/features/door/core");

  const auth = await requirePermission("staff", "door:coat-check");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { venueId, db } = auth;

  const body = await request.json();

  if (body.type === "lost-ticket") {
    const claim = await reportLostTicket(db, venueId, body.description, body.staffName);
    return NextResponse.json(claim, { status: 201 });
  }

  if (body.type === "lost-item") {
    const claim = await reportLostItem(db, venueId, body.ticketId, body.description, body.staffName);
    return NextResponse.json(claim, { status: 201 });
  }

  return NextResponse.json({ error: "Invalid claim type" }, { status: 400 });
}

export const POST = isDemoMode() ? demoHandler : livePOST;
