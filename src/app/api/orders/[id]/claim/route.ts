import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Order routes are disabled in demo mode" }, { status: 404 });
}

async function livePATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { requireApiArea, sessionToDbContext } = await import("@/server/auth-helpers");
  const { getDb } = await import("@/server/db");
  const { claimOrder } = await import("@/server/order-core");
  const { getRawPrisma } = await import("@/server/db");
  const { getCurrentStaff } = await import("@/server/staff-core");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const { id } = await params;
  const staff = await getCurrentStaff(getRawPrisma(), venueId, auth.session.user.id);
  if (!staff) return NextResponse.json({ error: "Staff profile not found" }, { status: 403 });
  const result = await claimOrder(db, venueId, id, staff.id, staff.name);

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json(result.order);
}

export const PATCH = isDemoMode() ? demoHandler : livePATCH;
