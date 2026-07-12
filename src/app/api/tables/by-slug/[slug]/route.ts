import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Table routes are disabled in demo mode" }, { status: 404 });
}

/** Public — the guest QR landing doesn't have a session yet (see findTableByQrSlug). */
async function liveGET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { findTableByQrSlug } = await import("@/server/platform/guest-lookup");

  const { slug } = await params;
  const result = await findTableByQrSlug(slug);
  if (!result) return NextResponse.json({ error: "Table not found" }, { status: 404 });
  return NextResponse.json(result);
}

export const GET = isDemoMode() ? demoHandler : liveGET;
