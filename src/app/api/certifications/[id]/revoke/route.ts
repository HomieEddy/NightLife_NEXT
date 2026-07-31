import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Certification routes are disabled in demo mode" }, { status: 404 });
}

/** Revoking pulls a staff member off certified shifts — manager-only, audited. */
async function livePOST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { revokeCertification } = await import("@/features/workforce/certification-core");
  const { recordAuditEntry } = await import("@/features/tab/core");
  const { zCertificationAction } = await import("@/features/workforce/workforce-schemas");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zCertificationAction.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const { id } = await params;
  const cert = await revokeCertification(db, id);
  if (!cert) return NextResponse.json(null, { status: 404 });

  await recordAuditEntry(db, venueId, {
    actorStaffId: parsed.data.staffId,
    actorName: parsed.data.staffName,
    action: "certification:manage",
    targetType: "certification",
    targetId: cert.id,
    summary: `Revoked ${cert.type} certification`,
    metadata: { staffId: cert.staffId },
  });

  return NextResponse.json(cert);
}

export const POST = isDemoMode() ? demoHandler : livePOST;
