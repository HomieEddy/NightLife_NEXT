import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";
import { publish } from "@/features/realtime/events";

function demoHandler() {
  return NextResponse.json({ error: "Purchasing routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { recordWaste } = await import("@/features/platform/purchasing-core");
  const { zWaste } = await import("@/features/platform/purchasing-schemas");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zWaste.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const entry = await recordWaste(db, parsed.data.itemId, parsed.data.quantity, parsed.data.reason, parsed.data.staffId);

  publish({
    type: "WasteRecorded",
    venueId,
    payload: { menuItemId: parsed.data.itemId, quantity: parsed.data.quantity, reason: parsed.data.reason, staffId: parsed.data.staffId },
  }).catch(() => {});

  return NextResponse.json(entry, { status: 201 });
}

export const POST = isDemoMode() ? demoHandler : livePOST;
