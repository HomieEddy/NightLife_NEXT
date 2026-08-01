import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Tab routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { reportWalkout } = await import("@/features/tab/core");
  const { zReportWalkoutBody } = await import("@/features/tab/schemas");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zReportWalkoutBody.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { id } = await params;
  const { venueId } = sessionToDbContext(auth.session);
  const walkout = await reportWalkout(
    getDb({ venueId }), venueId, id,
    parsed.data.description, parsed.data.staffId, parsed.data.staffName,
  );
  if (!walkout) return NextResponse.json({ error: "Session not found" }, { status: 404 });
  return NextResponse.json(walkout, { status: 201 });
}

export const POST = isDemoMode() ? demoHandler : livePOST;
