import { NextResponse } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Billing routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET() {
  const { requireApiArea } = await import("@/server/auth-helpers");
  const { getPlatformDb } = await import("@/features/shared/db");
  const { listPlanConfigs } = await import("@/server/platform/admin-core");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const configs = await listPlanConfigs(getPlatformDb());
  return NextResponse.json(configs);
}

export const GET = isDemoMode() ? demoHandler : liveGET;
