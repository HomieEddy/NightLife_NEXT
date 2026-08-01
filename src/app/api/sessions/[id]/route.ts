import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Session routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { getSession } = await import("@/features/sessions/core");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const { id } = await params;
  const session = await getSession(getDb({ venueId }), id);
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(session);
}

async function livePATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { setSessionStatus } = await import("@/features/sessions/core");
  const { zSetSessionStatus } = await import("@/features/sessions/schemas");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zSetSessionStatus.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { venueId } = sessionToDbContext(auth.session);
  const { id } = await params;
  const result = await setSessionStatus(
    getDb({ venueId }),
    id,
    parsed.data.status,
    parsed.data.settlementMethod,
  );

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json(result.session);
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const PATCH = isDemoMode() ? demoHandler : livePATCH;
