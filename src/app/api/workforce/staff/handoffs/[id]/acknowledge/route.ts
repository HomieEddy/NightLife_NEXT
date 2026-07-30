import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Workforce routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { acknowledgeHandoff } = await import("@/features/workforce/assignment-core");
  const { zAcknowledgeHandoff } = await import("@/features/workforce/workforce-schemas");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zAcknowledgeHandoff.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { id } = await params;
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const handoff = await acknowledgeHandoff(db, id, parsed.data.staffId, parsed.data.staffName);
  if (!handoff) return NextResponse.json({ error: "Handoff not found" }, { status: 404 });
  return NextResponse.json(handoff);
}

export const POST = isDemoMode() ? demoHandler : livePOST;
