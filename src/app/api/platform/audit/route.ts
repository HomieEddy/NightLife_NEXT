import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Platform routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET(request: NextRequest) {
  const { requireApiPlatformAdmin } = await import("@/features/platform/auth-helpers");
  const { getPlatformDb } = await import("@/features/shared/db");
  const { listAdminActions } = await import("@/features/platform/admin-core");

  const auth = await requireApiPlatformAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenantId = request.nextUrl.searchParams.get("tenantId") ?? undefined;
  const limit = Number(request.nextUrl.searchParams.get("limit")) || 50;
  const actions = await listAdminActions(getPlatformDb(), tenantId, limit);
  return NextResponse.json(actions);
}

export const GET = isDemoMode() ? demoHandler : liveGET;
