import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";
import { z } from "zod";

function demoHandler() {
  return NextResponse.json({ error: "Attention routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = z.object({
    staffId: z.string().min(1),
    staffName: z.string().min(1),
  }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { id } = await params;
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const item = await db.attentionItem.findFirst({ where: { id, venueId } });
  if (!item) return NextResponse.json({ error: "Attention item not found" }, { status: 404 });

  const ack = await db.attentionAcknowledgment.create({
    data: {
      attentionItemId: id,
      acknowledgedByStaffId: parsed.data.staffId,
      acknowledgedByStaffName: parsed.data.staffName,
    },
  });
  return NextResponse.json(ack, { status: 201 });
}

export const POST = isDemoMode() ? demoHandler : livePOST;
