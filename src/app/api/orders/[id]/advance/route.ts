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
  const { getDb, getRawPrisma } = await import("@/server/db");
  const { advanceOrder } = await import("@/server/order-core");
  const { getCurrentStaff } = await import("@/server/staff-core");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const { id } = await params;
  const staff = await getCurrentStaff(getRawPrisma(), venueId, auth.session.user.id);
  const order = await advanceOrder(db, id, staff ? { staffId: staff.id, staffName: staff.name } : undefined);

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(order);
}

export const PATCH = isDemoMode() ? demoHandler : livePATCH;
