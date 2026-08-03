import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Public routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET(_request: NextRequest, { params }: { params: Promise<{ venueSlug: string }> }) {
  const { getDb } = await import("@/features/shared/db");
  const { getRawPrisma } = await import("@/features/shared/db");
  const { listPublicEvents } = await import("@/features/hospitality/events-core");
  const { checkRateLimit, getClientIp } = await import("@/features/shared/rate-limit");

  const { venueSlug } = await params;

  // Rate limit: per-IP to prevent event-page scraping.
  const ip = getClientIp(_request);
  const rl = checkRateLimit(`events:${venueSlug}:${ip}`, { maxTokens: 30, refillRate: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  // Public route — resolve tenant by slug
  const prisma = getRawPrisma();
  const venue = await prisma.venue.findFirst({ where: { publicSlug: venueSlug }, select: { id: true } });
  if (!venue) return NextResponse.json(null, { status: 404 });

  const db = getDb({ venueId: venue.id });
  const result = await listPublicEvents(db, venueSlug);
  if (!result) return NextResponse.json(null, { status: 404 });

  return NextResponse.json(result);
}

export const GET = isDemoMode() ? demoHandler : liveGET;
