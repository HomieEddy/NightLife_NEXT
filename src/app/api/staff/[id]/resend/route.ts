import { headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Staff routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/server/auth-helpers");
  const { auth: betterAuth } = await import("@/server/auth");
  const { getRawPrisma } = await import("@/server/db");
  const { staffRoleToOrgRole } = await import("@/server/staff-core");
  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const venueId = sessionToDbContext(auth.session).venueId;
  const { id } = await params;
  const invitation = await getRawPrisma().invitation.findFirst({ where: { id, organizationId: venueId, status: "pending" } });
  if (!invitation) return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  const api = betterAuth.api as Record<string, (...args: never[]) => Promise<unknown>>;
  await api.createInvitation({
    headers: await headers(),
    body: {
      email: invitation.email,
      role: staffRoleToOrgRole(invitation.floorRole ?? "runner"),
      organizationId: venueId,
      resend: true,
    },
  } as never);
  return NextResponse.json({ ok: true });
}

export const POST = isDemoMode() ? demoHandler : livePOST;
