import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";
import { z } from "zod";

function demoHandler() {
  return NextResponse.json({ error: "Session routes are disabled in demo mode" }, { status: 404 });
}

const zNote = z.object({
  note: z.string().min(1),
  staffId: z.string().min(1),
  staffName: z.string().min(1),
});

async function liveGET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const notes = await db.sessionNote.findMany({
    where: { venueId, sessionId: id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(notes);
}

async function livePOST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zNote.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { id } = await params;
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const session = await db.guestSession.findFirst({ where: { id, venueId } });
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const note = await db.sessionNote.create({
    data: {
      venueId,
      sessionId: id,
      note: parsed.data.note,
      createdByStaffId: parsed.data.staffId,
      createdByStaffName: parsed.data.staffName,
    },
  });
  return NextResponse.json(note, { status: 201 });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
