import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Lead capture is disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest) {
  const { getPlatformDb } = await import("@/features/shared/db");
  const { createLead } = await import("@/server/platform/admin-core");
  const { checkRateLimit } = await import("@/features/shared/rate-limit");

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";

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
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

export const POST = isDemoMode() ? demoHandler : livePOST;
