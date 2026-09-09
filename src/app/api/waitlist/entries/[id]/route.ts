import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Waitlist routes are disabled in demo mode" }, { status: 404 });
}

async function livePATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requirePermission } = await import("@/features/platform/permission-guard");

  const auth = await requirePermission("staff", "waitlist:manage");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { venueId, db } = auth;

  const { id } = await params;
  const body = await request.json();
  const entry = await db.waitlistEntry.findFirst({ where: { id, venueId } });
  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

  const updated = await db.waitlistEntry.update({
    where: { id },
    data: { status: body.status },
  });
  return NextResponse.json(updated);
}

export const PATCH = isDemoMode() ? demoHandler : livePATCH;
