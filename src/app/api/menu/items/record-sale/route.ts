import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Menu routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { recordSale } = await import("@/features/menu/core");
  const { zRecordSale } = await import("@/features/menu/schemas");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zRecordSale.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const result = await recordSale(db, venueId, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json({ ok: true });
}

export const POST = isDemoMode() ? demoHandler : livePOST;
