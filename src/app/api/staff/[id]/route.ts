import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Staff routes are disabled in demo mode" }, { status: 404 });
}

async function livePATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getRawPrisma } = await import("@/features/shared/db");
  const { updateStaff } = await import("@/features/workforce/staff-core");
  const { zStaffPatch } = await import("@/features/workforce/staff-schemas");
  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = zStaffPatch.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const { id } = await params;
  const member = await updateStaff(getRawPrisma(), sessionToDbContext(auth.session).venueId, id, parsed.data);
  if (!member) return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
  return NextResponse.json(member);
}

async function liveDELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getRawPrisma } = await import("@/features/shared/db");
  const { removeStaff } = await import("@/features/workforce/staff-core");
  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const removed = await removeStaff(getRawPrisma(), sessionToDbContext(auth.session).venueId, id);
  if (!removed) return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export const PATCH = isDemoMode() ? demoHandler : livePATCH;
export const DELETE = isDemoMode() ? demoHandler : liveDELETE;
