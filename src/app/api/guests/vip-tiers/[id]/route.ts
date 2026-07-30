import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";
import { z } from "zod";

function demoHandler() {
  return NextResponse.json({ error: "VIP tier routes are disabled in demo mode" }, { status: 404 });
}

const zPatch = z.object({
  benefit: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

async function livePATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zPatch.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { id } = await params;
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const existing = await db.vipTierBenefit.findFirst({ where: { id, venueId } });
  if (!existing) return NextResponse.json({ error: "Benefit not found" }, { status: 404 });

  const updated = await db.vipTierBenefit.update({ where: { id }, data: parsed.data });
  return NextResponse.json(updated);
}

async function liveDELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const existing = await db.vipTierBenefit.findFirst({ where: { id, venueId } });
  if (!existing) return NextResponse.json({ error: "Benefit not found" }, { status: 404 });

  await db.vipTierBenefit.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export const PATCH = isDemoMode() ? demoHandler : livePATCH;
export const DELETE = isDemoMode() ? demoHandler : liveDELETE;
