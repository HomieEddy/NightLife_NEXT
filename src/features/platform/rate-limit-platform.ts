import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit, getClientIp } from "@/features/shared/rate-limit";
import { apiRateLimitError } from "@/features/shared/api-error";

const PLATFORM_LIMITS = { maxTokens: 30, refillRate: 30, windowMs: 60_000 };

export function platformRateLimit(
  request: NextRequest,
  sessionId: string,
): NextResponse | null {
  const ip = getClientIp(request);

  const ipCheck = checkRateLimit(`platform:ip:${ip}`, PLATFORM_LIMITS);
  if (!ipCheck.allowed) {
    return apiRateLimitError(ipCheck.retryAfterMs);
  }

  const sessionCheck = checkRateLimit(`platform:session:${sessionId}`, PLATFORM_LIMITS);
  if (!sessionCheck.allowed) {
    return apiRateLimitError(sessionCheck.retryAfterMs);
  }

  return null;
}
