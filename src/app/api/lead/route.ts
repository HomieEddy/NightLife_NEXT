import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Lead capture is disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest) {
  const { getPlatformDb } = await import("@/features/shared/db");
  const { createLead } = await import("@/features/platform/admin-core");
  const { checkRateLimit, getClientIp } = await import("@/features/shared/rate-limit");

  const ip = getClientIp(request);

  const rl = checkRateLimit(`lead:${ip}`, { maxTokens: 5, refillRate: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  // Honeypot: hidden field that bots fill in
  if (body.website) {
    return NextResponse.json({ ok: true });
  }

  if (!body.venueName || !body.contactName || !body.email) {
    return NextResponse.json({ error: "venueName, contactName, and email are required" }, { status: 400 });
  }

  await createLead(getPlatformDb(), {
    venueName: body.venueName,
    contactName: body.contactName,
    email: body.email,
    phone: body.phone,
    city: body.city,
    source: body.source ?? "landing-page",
    dealValue: body.dealValue,
    notes: body.notes,
    consentAt: typeof body.consentAt === "string" ? body.consentAt : undefined,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

export const POST = isDemoMode() ? demoHandler : livePOST;
