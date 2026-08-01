import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Guest routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { findCandidates } = await import("@/features/guests/core");
  const { zFindCandidates } = await import("@/features/guests/schemas");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zFindCandidates.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  return NextResponse.json(await findCandidates(db, {
    ...parsed.data,
    firstName: parsed.data.firstName ?? "",
  }));
}

export const POST = isDemoMode() ? demoHandler : livePOST;
