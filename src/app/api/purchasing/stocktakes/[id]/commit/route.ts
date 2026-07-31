import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";
import { publish } from "@/features/realtime/events";

function demoHandler() {
  return NextResponse.json({ error: "Purchasing routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { commitStocktake } = await import("@/features/platform/purchasing-core");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const stocktake = await commitStocktake(db, id);

  publish({
    type: "StocktakeCommitted",
    venueId,
    payload: { stocktakeId: id, businessDate: stocktake.businessDate, totalVarianceCents: stocktake.totalVarianceCents },
  }).catch(() => {});

  return NextResponse.json(stocktake);
}

export const POST = isDemoMode() ? demoHandler : livePOST;
