import { headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Staff routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET() {
  const { requireApiArea, sessionToDbContext } = await import("@/server/auth-helpers");
  const { getRawPrisma } = await import("@/server/db");
  const { listStaff } = await import("@/server/staff-core");
  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json(await listStaff(getRawPrisma(), sessionToDbContext(auth.session).venueId));
}

async function livePOST(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/server/auth-helpers");
  const { auth: betterAuth } = await import("@/server/auth");
  const { getRawPrisma } = await import("@/server/db");
  const { listStaff, staffRoleToOrgRole } = await import("@/server/staff-core");
  const { zStaffInvite } = await import("@/server/schemas/staff");
  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = zStaffInvite.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const venueId = sessionToDbContext(auth.session).venueId;
  const api = betterAuth.api as Record<string, (...args: never[]) => Promise<unknown>>;
  const invitation = await api.createInvitation({
    headers: await headers(),
    body: {
      email: parsed.data.email.trim().toLowerCase(),
      role: staffRoleToOrgRole(parsed.data.role),
      organizationId: venueId,
    },
  } as never) as { id: string };
  const prisma = getRawPrisma();
  await prisma.invitation.update({
    where: { id: invitation.id },
    data: {
      draftName: parsed.data.name,
      draftPhone: parsed.data.phone,
      floorRole: parsed.data.role,
      assignedZoneIds: parsed.data.assignedZoneIds,
    },
  });
  const staff = await listStaff(prisma, venueId);
  return NextResponse.json(staff.find((member) => member.id === invitation.id), { status: 201 });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
