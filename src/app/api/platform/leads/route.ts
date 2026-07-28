import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Platform routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET() {
  const { requireApiPlatformAdmin } = await import("@/server/auth-helpers");
  const { getPlatformDb } = await import("@/features/shared/db");
  const { listLeads } = await import("@/server/platform/admin-core");

  const auth = await requireApiPlatformAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const leads = await listLeads(getPlatformDb());
  return NextResponse.json(leads);
}

async function livePOST(request: NextRequest) {
  const { requireApiPlatformAdmin } = await import("@/server/auth-helpers");
  const { getPlatformDb } = await import("@/features/shared/db");
  const { createLead } = await import("@/server/platform/admin-core");

  const auth = await requireApiPlatformAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  if (!body.venueName || !body.contactName || !body.email) {
    return NextResponse.json({ error: "venueName, contactName, and email are required" }, { status: 400 });
  }

  const lead = await createLead(getPlatformDb(), body);
  return NextResponse.json(lead, { status: 201 });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
