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

/**
 * Known business failure carrying a user-facing message and its HTTP status.
 * Domain cores throw this for preconditions (already evacuated, not clocked
 * in, not in draft); route handlers catch it and return the message as-is —
 * anything else is a 5xx and gets sanitized.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

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

/**
 * Route-handler catch helper: known business failures pass through with their
 * message and status; anything else is logged and sanitized as a generic 500.
 */
export function apiErrorFromCatch(
  e: unknown,
  logMessage: string,
): NextResponse<{ error: string }> {
  if (e instanceof HttpError) return apiError(e.status, e.message);
  logger.error(logMessage, { error: String(e) });
  return apiError(500, "Operation failed", { detail: e });
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
