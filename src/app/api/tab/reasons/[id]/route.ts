import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Tab routes are disabled in demo mode" }, { status: 404 });
}

async function livePATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { setAdjustmentReasonActive } = await import("@/features/tab/core");
  const { zToggleReasonActive } = await import("@/features/tab/schemas");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zToggleReasonActive.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { id } = await params;
  const db = getDb({ venueId: sessionToDbContext(auth.session).venueId });
  const reason = await setAdjustmentReasonActive(db, id, parsed.data.isActive);
  if (!reason) return NextResponse.json({ error: "Reason not found" }, { status: 404 });
  return NextResponse.json(reason);
}

export const PATCH = isDemoMode() ? demoHandler : livePATCH;
