import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { getAppMode } from "@/lib/app-mode";

export function proxy(request: NextRequest) {
  if (getAppMode() === "demo") {
    return NextResponse.next();
  }

  if (
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname.startsWith("/demo") ||
    request.nextUrl.pathname.startsWith("/lead") ||
    request.nextUrl.pathname.startsWith("/manager/subscription")
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
