import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { getAppMode } from "@/features/shared/app-mode";
import { cookieName } from "@/i18n/config";
import { generateRequestId } from "@/features/shared/request-id";
import { logger } from "@/features/shared/logger";
import { checkRateLimit, getClientIp } from "@/features/shared/rate-limit";
import { apiRateLimitError } from "@/features/shared/api-error";
import { isBlockedBot, isTrustedCrawler } from "@/features/shared/bot-block";

/** Valid ?lang= values for the /r and /e embed overrides. */
const EMBED_LANGS = new Set(["fr", "en"]);

/** Rate-limit/block responses must never be cached — a CDN-served 429
 *  would start blocking legit users sharing an IP. */
function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export function proxy(request: NextRequest) {
  // ?lang= override for the embeddable /r and /e surfaces: a venue's French
  // website embeds `?lang=fr`. The request cookie makes THIS render French
  // (first paint), the response cookie persists it for subsequent navigation.
  const lang = request.nextUrl.searchParams.get("lang");
  const langOverride = lang !== null && EMBED_LANGS.has(lang) ? lang : null;
  if (langOverride) {
    request.cookies.set(cookieName, langOverride);
  }

  const persistLang = (response: NextResponse) => {
    if (langOverride) {
      response.cookies.set(cookieName, langOverride, {
        path: "/",
        sameSite: "lax",
        maxAge: 365 * 24 * 60 * 60,
      });
    }
    return response;
  };

  if (getAppMode() === "demo") {
    const userAgent = request.headers.get("user-agent");

    // 1. Known-abusive bots: hard 403 before any page/API function runs —
    //    the Vercel bill guard (every demo page hit is an invocation).
    //    robots.txt is advisory; this is the enforcement layer.
    if (isBlockedBot(userAgent)) {
      return persistLang(
        noStore(
          new NextResponse("Blocked", {
            status: 403,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          }),
        ),
      );
    }

    // 2. Per-IP rate limit for everything else; trusted crawlers (search
    //    engines, social previews) are exempt so indexing and OG unfurls
    //    never trip it. In-memory buckets — exact per instance: the
    //    OVHcloud persistent process gets the full effect, Vercel warm
    //    instances get best-effort burst absorption.
    if (!isTrustedCrawler(userAgent)) {
      const isApi = request.nextUrl.pathname.startsWith("/api/");
      const rl = checkRateLimit(
        `demo:${isApi ? "api" : "page"}:${getClientIp(request)}`,
        {
          maxTokens: isApi ? 60 : 240,
          refillRate: isApi ? 60 : 240,
          windowMs: 60_000,
        },
      );
      if (!rl.allowed) {
        return persistLang(noStore(apiRateLimitError(rl.retryAfterMs)));
      }
    }

    // 3. The demo build's home is the tour — a hard 308 before streaming so
    //    crawlers consolidate the root into /demo (the page component also
    //    redirects, covering client-side navigation).
    if (request.nextUrl.pathname === "/") {
      return persistLang(
        NextResponse.redirect(new URL("/demo", request.url), 308),
      );
    }
    return persistLang(NextResponse.next());
  }

  // Access-log + request-id plumbing. The id propagates downstream via the
  // request header and echoes back on every response, so a support screenshot
  // (or a 5xx body from apiError) maps to a log line.
  const requestId = request.headers.get("x-request-id") ?? generateRequestId();
  request.headers.set("x-request-id", requestId);
  const start = performance.now();

  const finish = (response: NextResponse) => {
    persistLang(response);
    response.headers.set("x-request-id", requestId);
    const level =
      response.status >= 500
        ? "error"
        : response.status >= 400
          ? "warn"
          : "info";
    logger[level]("access", {
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      status: response.status,
      duration_ms: Math.round(performance.now() - start),
    });
    return response;
  };

  // The marketing landing is public — no session required.
  if (request.nextUrl.pathname === "/") {
    return finish(NextResponse.next());
  }

  // /r and /e are public embed surfaces (no session) — pass through.
  if (
    request.nextUrl.pathname.startsWith("/r/") ||
    request.nextUrl.pathname.startsWith("/e/")
  ) {
    return finish(NextResponse.next());
  }

  // /admin requires a session cookie — the layout's requirePlatformAdmin()
  // does the role check, but the proxy bounces unauthenticated requests early.
  if (request.nextUrl.pathname.startsWith("/admin")) {
    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      return finish(NextResponse.redirect(new URL("/login", request.url)));
    }
    return finish(NextResponse.next());
  }

  // /lead is a public page — no auth required.
  if (request.nextUrl.pathname.startsWith("/lead")) {
    return finish(NextResponse.next());
  }

  // /demo stays 404 in the live build — the tour is a demo-only surface.
  if (
    request.nextUrl.pathname.startsWith("/demo")
  ) {
    return finish(new NextResponse("Not Found", { status: 404 }));
  }

  // API routes authenticate internally (session, guest cookie, CRON secret) —
  // pass through to their own auth.
  if (request.nextUrl.pathname.startsWith("/api")) {
    return finish(NextResponse.next());
  }

  // Guests authenticate with their table-session cookie (set by the QR join
  // flow), not a staff login — without it, back to the landing page to rescan.
  if (request.nextUrl.pathname.startsWith("/guest")) {
    const guestSession = request.cookies.get("nln-guest-session")?.value;
    if (!guestSession) {
      return finish(NextResponse.redirect(new URL("/", request.url)));
    }
    return finish(NextResponse.next());
  }

  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    return finish(NextResponse.redirect(new URL("/login", request.url)));
  }

  return finish(NextResponse.next());
}

export const config = {
  matcher: [
    "/",
    "/r/:path*",
    "/e/:path*",
    "/manager/:path*",
    "/staff/:path*",
    "/admin/:path*",
    "/lead/:path*",
    "/demo/:path*",
    "/guest/:path*",
    "/api/:path*",
  ],
};
