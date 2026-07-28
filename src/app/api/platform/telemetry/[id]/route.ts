import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Platform routes are disabled in demo mode" }, { status: 404 });
}

type Ctx = { params: Promise<{ id: string }> };

async function livePATCH(request: NextRequest, ctx: Ctx) {
  const { requireApiPlatformAdmin } = await import("@/server/auth-helpers");
  const { getPlatformDb } = await import("@/features/shared/db");
  const { updateTelemetryLink } = await import("@/server/platform/admin-core");

  const auth = await requireApiPlatformAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await ctx.params;
  const body = await request.json();
  const link = await updateTelemetryLink(getPlatformDb(), id, body);
  if (!link) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  return NextResponse.json(link);
}

async function liveDELETE(_request: NextRequest, ctx: Ctx) {
  const { requireApiPlatformAdmin } = await import("@/server/auth-helpers");
  const { getPlatformDb } = await import("@/features/shared/db");
  const { deleteTelemetryLink } = await import("@/server/platform/admin-core");

  const auth = await requireApiPlatformAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await ctx.params;
  await deleteTelemetryLink(getPlatformDb(), id);
  return NextResponse.json({ ok: true });
}

export const PATCH = isDemoMode() ? demoHandler : livePATCH;
export const DELETE = isDemoMode() ? demoHandler : liveDELETE;
