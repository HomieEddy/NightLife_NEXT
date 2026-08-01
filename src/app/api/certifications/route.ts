import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Certification routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { listCertifications } = await import("@/features/workforce/certification-core");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const staffId = request.nextUrl.searchParams.get("staffId") ?? undefined;
  return NextResponse.json(await listCertifications(db, staffId));
}

async function livePOST(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { createCertification } = await import("@/features/workforce/certification-core");
  const { recordAuditEntry } = await import("@/features/tab/core");
  const { zCreateCertification } = await import("@/features/workforce/workforce-schemas");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zCreateCertification.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });
  const cert = await createCertification(db, venueId, parsed.data);

  await recordAuditEntry(db, venueId, {
    actorStaffId: parsed.data.createdByStaffId,
    actorName: parsed.data.createdByStaffName,
    action: "certification:manage",
    targetType: "certification",
    targetId: cert.id,
    summary: `Created ${cert.type} certification for staff — expires ${cert.expiresAt}`,
    metadata: { staffId: cert.staffId },
  });

  return NextResponse.json(cert);
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
