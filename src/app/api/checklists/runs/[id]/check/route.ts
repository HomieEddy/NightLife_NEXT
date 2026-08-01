import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Checklist routes are not available in demo mode" }, { status: 404 });
}

async function livePATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { checkItem } = await import("@/features/venue/checklist-core");
  const { zCheckItem } = await import("@/features/venue/checklist-schemas");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const parsed = zCheckItem.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const run = await checkItem(db, id, parsed.data.templateItemId, parsed.data.checked, parsed.data.staffId, parsed.data.note);
  if (!run) return NextResponse.json({ error: "Run not found or not in-progress" }, { status: 404 });
  return NextResponse.json(run);
}

export const PATCH = isDemoMode() ? demoHandler : livePATCH;
