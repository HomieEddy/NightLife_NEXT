import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Session routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requirePermission } = await import("@/features/platform/permission-guard");

  // service:refuse is manager/host/bartender/security. A runner or promoter
  // token must not be able to block a table's service.
  const auth = await requirePermission("staff", "service:refuse");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { venueId, db } = auth;

  const { id } = await params;
  const body = await request.json();

  const session = await db.guestSession.findFirst({ where: { id, venueId } });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  await db.auditEntry.create({
    data: {
      venueId,
      actorStaffId: body.staffId,
      actorName: body.staffName,
      action: "session:refuse-service",
      targetType: "guest-session",
      targetId: id,
      summary: `Refused service for session ${id}: ${body.reason}`,
    },
  });

  await db.guestSession.update({
    where: { id },
    data: { serviceRefusedAt: new Date(), serviceRefusedReason: body.reason },
  });
  return NextResponse.json({ ok: true });
}

export const POST = isDemoMode() ? demoHandler : livePOST;
