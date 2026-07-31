import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";
import { publish } from "@/features/realtime/events";

function demoHandler() {
  return NextResponse.json({ error: "Purchasing routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requirePermission } = await import("@/features/platform/permission-guard");
  const { commitStocktake } = await import("@/features/platform/purchasing-core");

  const auth = await requirePermission("staff", "stocktake:commit");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const { venueId, db } = auth;
  const stocktake = await commitStocktake(db, id);

  publish({
    type: "StocktakeCommitted",
    venueId,
    payload: { stocktakeId: id, businessDate: stocktake.businessDate, totalVarianceCents: stocktake.totalVarianceCents },
  }).catch(() => {});

  return NextResponse.json(stocktake);
}

export const POST = isDemoMode() ? demoHandler : livePOST;
