import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Attention routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const url = new URL(request.url);
  const resolved = url.searchParams.get("resolved");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { venueId };
  if (resolved === "true") where.resolved = true;
  else if (resolved === "false") where.resolved = false;

  const [items, acknowledgments] = await Promise.all([
    db.attentionItem.findMany({ where, orderBy: { createdAt: "desc" }, include: { acknowledgments: true }, take: 200 }),
    db.attentionAcknowledgment.findMany({ where: { attentionItem: { venueId } }, orderBy: { acknowledgedAt: "desc" }, take: 200 }),
  ]);

  return NextResponse.json({ items, acknowledgments });
}

async function livePOST(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { z } = await import("zod");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const parsed = z.object({
    type: z.string().min(1),
    severity: z.string().min(1),
    tableId: z.string().min(1),
    tableCode: z.string().min(1),
    zoneName: z.string().min(1),
    message: z.string().min(1),
    ageMinutes: z.number().int().optional(),
  }).safeParse(await request.json());

  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const item = await db.attentionItem.create({ data: { ...parsed.data, venueId } });
  return NextResponse.json(item, { status: 201 });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
