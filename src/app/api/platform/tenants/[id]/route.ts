import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Platform routes are disabled in demo mode" }, { status: 404 });
}

type Ctx = { params: Promise<{ id: string }> };

async function liveGET(_request: NextRequest, ctx: Ctx) {
  const { requireApiPlatformAdmin } = await import("@/features/platform/auth-helpers");
  const { getPlatformDb } = await import("@/features/shared/db");
  const { getTenant } = await import("@/features/platform/admin-core");

  const auth = await requireApiPlatformAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await ctx.params;
  const tenant = await getTenant(getPlatformDb(), id);
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  return NextResponse.json(tenant);
}

async function livePATCH(request: NextRequest, ctx: Ctx) {
  const { requireApiPlatformAdmin } = await import("@/features/platform/auth-helpers");
  const { getPlatformDb } = await import("@/features/shared/db");
  const { updateTenant } = await import("@/features/platform/admin-core");
  const { platformRateLimit } = await import("@/features/platform/rate-limit-platform");

  const auth = await requireApiPlatformAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = platformRateLimit(request, auth.session.session.id);
  if (rl) return rl;

  const { id } = await ctx.params;
  const body = await request.json();
  const tenant = await updateTenant(getPlatformDb(), id, body, auth.session);
  if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  return NextResponse.json(tenant);
}

async function liveDELETE(request: NextRequest, ctx: Ctx) {
  const { requireApiPlatformAdmin } = await import("@/features/platform/auth-helpers");
  const { getPlatformDb } = await import("@/features/shared/db");
  const { deleteTenant } = await import("@/features/platform/admin-core");
  const { platformRateLimit } = await import("@/features/platform/rate-limit-platform");

  const auth = await requireApiPlatformAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = platformRateLimit(request, auth.session.session.id);
  if (rl) return rl;

  const { id } = await ctx.params;
  await deleteTenant(getPlatformDb(), id, auth.session);
  return NextResponse.json({ ok: true });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const PATCH = isDemoMode() ? demoHandler : livePATCH;
export const DELETE = isDemoMode() ? demoHandler : liveDELETE;
