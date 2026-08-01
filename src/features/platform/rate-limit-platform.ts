import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/features/shared/rate-limit";

const PLATFORM_LIMITS = { maxTokens: 30, refillRate: 30, windowMs: 60_000 };

export function platformRateLimit(
  request: NextRequest,
  sessionId: string,
): NextResponse | null {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";

  const ipCheck = checkRateLimit(`platform:ip:${ip}`, PLATFORM_LIMITS);
  if (!ipCheck.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(ipCheck.retryAfterMs / 1000)) } },
    );
  }

  const sessionCheck = checkRateLimit(`platform:session:${sessionId}`, PLATFORM_LIMITS);
  if (!sessionCheck.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(sessionCheck.retryAfterMs / 1000)) } },
    );
  }

  return null;
}
