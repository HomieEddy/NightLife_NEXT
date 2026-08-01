import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Bar tab routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const tab = await db.barTab.findFirst({ where: { id, venueId } });
  if (!tab) return NextResponse.json({ error: "Bar tab not found" }, { status: 404 });
  if (tab.status !== "open") return NextResponse.json({ error: "Bar tab is already closed" }, { status: 409 });

  const closed = await db.barTab.update({
    where: { id },
    data: { status: "closed", closedAt: new Date() },
  });
  return NextResponse.json(closed);
}

export const POST = isDemoMode() ? demoHandler : livePOST;
