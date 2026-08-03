import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";
import { logger } from "@/features/shared/logger";

function demoHandler() {
  return NextResponse.json({ error: "Platform routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET() {
  const { requireApiPlatformAdmin } = await import("@/features/platform/auth-helpers");
  const { getPlatformDb } = await import("@/features/shared/db");
  const { listPlanConfigs } = await import("@/features/platform/admin-core");

  const auth = await requireApiPlatformAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const configs = await listPlanConfigs(getPlatformDb());
  return NextResponse.json(configs);
}

async function livePATCH(request: NextRequest) {
  const { requireApiPlatformAdmin } = await import("@/features/platform/auth-helpers");
  const { getPlatformDb } = await import("@/features/shared/db");
  const { updatePlanConfig } = await import("@/features/platform/admin-core");
  const { platformRateLimit } = await import("@/features/platform/rate-limit-platform");

  const auth = await requireApiPlatformAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = platformRateLimit(request, auth.session.session.id);
  if (rl) return rl;

  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { id, ...patch } = body;
  try {
    const config = await updatePlanConfig(getPlatformDb(), id, patch, auth.session);
    if (!config) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    return NextResponse.json(config);
  } catch (e) {
    logger.error("Failed to update plan config", { error: String(e) });
    return NextResponse.json({ error: "Operation failed" }, { status: 400 });
  }
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const PATCH = isDemoMode() ? demoHandler : livePATCH;
