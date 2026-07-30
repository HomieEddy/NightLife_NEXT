import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Table routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const table = await db.venueTable.findFirst({ where: { id, venueId } });
  if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 });
  if (table.status !== "out_of_service") return NextResponse.json({ error: "Table is not out of service" }, { status: 409 });

  const updated = await db.venueTable.update({
    where: { id },
    data: { status: "open", holdReason: null, heldBy: null, heldUntil: null },
  });
  return NextResponse.json(updated);
}

export const POST = isDemoMode() ? demoHandler : livePOST;
