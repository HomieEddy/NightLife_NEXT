import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Session routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const { id } = await params;
  const body = await request.json();

  const session = await db.guestSession.findFirst({ where: { id, venueId } });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  await db.auditEntry.create({
    data: {
      venueId,
      actorStaffId: body.staffId,
      actorName: body.staffName,
      action: "session:eject",
      targetType: "guest-session",
      targetId: id,
      summary: `Ejected guest from session ${id}: ${body.reason}`,
    },
  });

  await db.guestSession.update({ where: { id }, data: { status: "closed" } });
  if (session.tableId) {
    await db.venueTable.update({ where: { id: session.tableId }, data: { status: "open" } });
  }
  return NextResponse.json({ ok: true });
}

export const POST = isDemoMode() ? demoHandler : livePOST;
