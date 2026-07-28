import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { getAppMode } from "@/features/shared/app-mode";

export function proxy(request: NextRequest) {
  if (getAppMode() === "demo") {
    return NextResponse.next();
  }

  // /admin requires a session cookie — the layout's requirePlatformAdmin()
  // does the role check, but the proxy bounces unauthenticated requests early.
  if (request.nextUrl.pathname.startsWith("/admin")) {
    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  // /lead is a public page — no auth required.
  if (request.nextUrl.pathname.startsWith("/lead")) {
    return NextResponse.next();
  }

  // /demo stays 404 in the live build — the tour is a demo-only surface.
  if (
    request.nextUrl.pathname.startsWith("/demo")
  ) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // Guests authenticate with their table-session cookie (set by the QR join
  // flow), not a staff login — without it, back to the landing page to rescan.
  if (request.nextUrl.pathname.startsWith("/guest")) {
    const guestSession = request.cookies.get("nln-guest-session")?.value;
    if (!guestSession) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/manager/:path*",
    "/staff/:path*",
    "/admin/:path*",
    "/lead/:path*",
    "/demo/:path*",
    "/guest/:path*",
  ],
};
