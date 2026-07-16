import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Platform routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET() {
  const { requireApiPlatformAdmin } = await import("@/server/auth-helpers");
  const { getPlatformDb } = await import("@/server/db");
  const { listTenants } = await import("@/server/platform/admin-core");

  const auth = await requireApiPlatformAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const tenants = await listTenants(getPlatformDb());
  return NextResponse.json(tenants);
}

async function livePOST(request: NextRequest) {
  const { requireApiPlatformAdmin } = await import("@/server/auth-helpers");
  const { getPlatformDb } = await import("@/server/db");
  const { provisionTenant } = await import("@/server/platform/admin-core");

  const auth = await requireApiPlatformAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  if (!body.venueName) {
    return NextResponse.json({ error: "venueName is required" }, { status: 400 });
  }

  const tenant = await provisionTenant(getPlatformDb(), body, auth.session);
  return NextResponse.json(tenant, { status: 201 });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
