import { AsyncLocalStorage } from "node:async_hooks";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { logger } from "./logger";

const als = new AsyncLocalStorage<{ requestId: string }>();

/** Generate a fresh request id for propagation through the handler chain. */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/** Read the request id set by the current `withAccessLog` wrapper, if any. */
export function getRequestId(): string | undefined {
  return als.getStore()?.requestId;
}

/**
 * Wrap a route handler so every request gets a generated/propagated
 * `x-request-id`, one structured access-log line, and the id on the response
 * header (and on 5xx error bodies via `apiError`).
 */
export function withAccessLog(
  handler: (
    req: NextRequest,
    ctx?: unknown,
  ) => Promise<NextResponse>,
): (req: NextRequest, ctx?: unknown) => Promise<NextResponse> {
  return async (req, ctx) => {
    const requestId =
      req.headers.get("x-request-id") ?? generateRequestId();
    const start = performance.now();
    let response: NextResponse = NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
    try {
      response = await als.run({ requestId }, () => handler(req, ctx));
    } finally {
      const duration = Math.round(performance.now() - start);
      const level =
        response.status >= 500
          ? "error"
          : response.status >= 400
            ? "warn"
            : "info";
      logger[level]("access", {
        requestId,
        method: req.method,
        path: req.nextUrl.pathname,
        status: response.status,
        duration_ms: duration,
      });
    }
    response.headers.set("x-request-id", requestId);
    return response;
  };
}
