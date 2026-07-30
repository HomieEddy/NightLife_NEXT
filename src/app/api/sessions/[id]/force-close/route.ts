import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Session routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { z } = await import("zod");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = z.object({
    reason: z.string().min(1),
    staffId: z.string().min(1),
    staffName: z.string().min(1),
  }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { id } = await params;
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const session = await db.guestSession.findFirst({ where: { id, venueId } });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  if (!["approved", "closure_requested"].includes(session.status)) {
    return NextResponse.json({ error: `Cannot force-close a session in ${session.status} status` }, { status: 409 });
  }

  const updated = await db.guestSession.update({
    where: { id },
    data: { status: "closed", settledExternallyAt: new Date() },
  });
  return NextResponse.json(updated);
}

export const POST = isDemoMode() ? demoHandler : livePOST;
