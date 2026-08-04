import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { getAppMode } from "@/features/shared/app-mode";
import { cookieName } from "@/i18n/config";
import { generateRequestId } from "@/features/shared/request-id";
import { logger } from "@/features/shared/logger";

/** Valid ?lang= values for the /r and /e embed overrides. */
const EMBED_LANGS = new Set(["fr", "en"]);

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
