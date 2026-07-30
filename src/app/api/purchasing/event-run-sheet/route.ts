import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Purchasing routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET(request: NextRequest) {
  const { requireApiArea } = await import("@/features/platform/auth-helpers");
  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const eventId = request.nextUrl.searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "eventId query param is required" }, { status: 400 });
  return NextResponse.json({ error: "Event run sheets not yet implemented — no EventRun model in schema" }, { status: 501 });
}

async function livePOST(request: NextRequest) {
  const { requireApiArea } = await import("@/features/platform/auth-helpers");
  const { zSaveRunSheet } = await import("@/features/platform/purchasing-schemas");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zSaveRunSheet.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  return NextResponse.json({ error: "Event run sheets not yet implemented — no EventRun model in schema" }, { status: 501 });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
