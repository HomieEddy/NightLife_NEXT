import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Platform routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET() {
  const { requireApiPlatformAdmin } = await import("@/features/platform/auth-helpers");
  const { getPlatformDb } = await import("@/features/shared/db");
  const { listTelemetryLinks } = await import("@/features/platform/admin-core");

  const auth = await requireApiPlatformAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const links = await listTelemetryLinks(getPlatformDb());
  return NextResponse.json(links);
}

async function livePOST(request: NextRequest) {
  const { requireApiPlatformAdmin } = await import("@/features/platform/auth-helpers");
  const { getPlatformDb } = await import("@/features/shared/db");
  const { createTelemetryLink } = await import("@/features/platform/admin-core");

  const auth = await requireApiPlatformAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  if (!body.name || !body.url) {
    return NextResponse.json({ error: "name and url are required" }, { status: 400 });
  }

  const link = await createTelemetryLink(getPlatformDb(), body);
  return NextResponse.json(link, { status: 201 });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
