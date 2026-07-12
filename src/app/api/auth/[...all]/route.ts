import { isDemoMode } from "@/lib/app-mode";
import type { NextRequest } from "next/server";

function demoHandler() {
  return new Response("Auth routes are disabled in demo mode", { status: 404 });
}

async function liveGET(request: NextRequest) {
  const { auth } = await import("@/server/auth");
  const { toNextJsHandler } = await import("better-auth/next-js");
  const { GET } = toNextJsHandler(auth);
  return GET(request);
}

async function livePOST(request: NextRequest) {
  const { auth } = await import("@/server/auth");
  const { toNextJsHandler } = await import("better-auth/next-js");
  const { POST } = toNextJsHandler(auth);
  return POST(request);
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
