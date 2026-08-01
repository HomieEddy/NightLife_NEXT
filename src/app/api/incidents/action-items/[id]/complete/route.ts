import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Complete-action-item routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { completeActionItem } = await import("@/features/safety/core");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const { id } = await params;
  await completeActionItem(db, id);
  return NextResponse.json({ ok: true });
}

export const POST = isDemoMode() ? demoHandler : livePOST;
