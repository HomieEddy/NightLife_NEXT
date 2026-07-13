import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Help request routes are disabled in demo mode" }, { status: 404 });
}

async function livePATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/server/auth-helpers");
  const { getDb } = await import("@/server/db");
  const { setHelpRequestStatus } = await import("@/server/session-core");
  const { zSetHelpStatus } = await import("@/server/schemas/sessions");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zSetHelpStatus.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { venueId } = sessionToDbContext(auth.session);
  const { id } = await params;
  const result = await setHelpRequestStatus(getDb({ venueId }), id, parsed.data.status);

  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(result);
}

export const PATCH = isDemoMode() ? demoHandler : livePATCH;
