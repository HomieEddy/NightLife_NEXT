/**
 * Centralised API error response builder.
 *
 * - 4xx: the caller's message is returned as-is (Zod field errors, auth
 *   rejections, "not found" — these are UX, not leakage).
 * - 5xx: the caller's message and detail are logged, but the response body
 *   always reads "Internal server error" — never leaks stack traces or DB
 *   internals. The proxy stamps `x-request-id` on every response, so a 5xx
 *   body maps to its access-log line.
 * - 429: includes a `Retry-After` header when `retryAfterSec` is provided.
 */

import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { logger } from "@/features/shared/logger";

interface ApiErrorOpts {
  /** Logged for 5xx; ignored for 4xx. */
  detail?: unknown;
  /** Extra response headers (Retry-After, etc.). */
  headers?: Record<string, string>;
}

export function apiError(
  status: number,
  message: string,
  opts?: ApiErrorOpts,
): NextResponse<{ error: string }> {
  const headers: Record<string, string> = {};
  if (opts?.headers) Object.assign(headers, opts.headers);

  if (status >= 500) {
    logger.error(message, { detail: opts?.detail });
    return NextResponse.json(
      { error: "Internal server error" },
      { status, headers },
    );
  }
  return NextResponse.json({ error: message }, { status, headers });
}

/** Convenience wrapper for Zod validation errors — field-level detail is UX. */
export function apiZodError(err: ZodError): NextResponse<{ error: string }> {
  return NextResponse.json({ error: err.message }, { status: 400 });
}

/** Convenience wrapper for rate-limit rejections. */
export function apiRateLimitError(retryAfterMs: number): NextResponse<{ error: string }> {
  return NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
    },
  );
}
