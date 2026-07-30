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
  const { transferSession } = await import("@/features/tab/core");
  const { zTransferSession } = await import("@/features/tab/schemas");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zTransferSession.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { id } = await params;
  const { venueId } = sessionToDbContext(auth.session);
  const result = await transferSession(getDb({ venueId }), venueId, id, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json(result.session);
}

export const PATCH = isDemoMode() ? demoHandler : livePATCH;
