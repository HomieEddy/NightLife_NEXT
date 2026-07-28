import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Platform routes are disabled in demo mode" }, { status: 404 });
}

type Ctx = { params: Promise<{ id: string }> };

async function livePATCH(request: NextRequest, ctx: Ctx) {
  const { requireApiPlatformAdmin } = await import("@/features/platform/auth-helpers");
  const { getPlatformDb } = await import("@/features/shared/db");
  const { setLeadStatus } = await import("@/features/platform/admin-core");

  const auth = await requireApiPlatformAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await ctx.params;
  const { status } = await request.json();
  if (!status) return NextResponse.json({ error: "status is required" }, { status: 400 });

  const lead = await setLeadStatus(getPlatformDb(), id, status);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json(lead);
}

export const PATCH = isDemoMode() ? demoHandler : livePATCH;
