import { NextResponse } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Help request routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET() {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { listHelpRequests } = await import("@/features/sessions/core");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  return NextResponse.json(await listHelpRequests(getDb({ venueId })));
}

export const GET = isDemoMode() ? demoHandler : liveGET;
