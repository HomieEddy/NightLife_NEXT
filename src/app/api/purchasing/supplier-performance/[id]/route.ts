import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Purchasing routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  // Count on-time POs and fill rate from this supplier
  const pos = await db.purchaseOrder.findMany({ where: { supplierId: id } });
  const total = pos.length;
  const onTime = pos.filter((po: { status: string; expectedAt: Date | null; submittedAt: Date | null }) =>
    po.status === "received" && po.expectedAt && po.submittedAt && po.submittedAt <= po.expectedAt,
  ).length;

  return NextResponse.json({
    supplierId: id,
    totalOrders: total,
    onTimeRate: total > 0 ? onTime / total : null,
    fillRate: null, // ponytail: fill rate needs line-level PO data — add when analytics module consumes purchase-order detail
    qualityRating: null,
  });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
