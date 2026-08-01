import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";
import { z } from "zod";

function demoHandler() {
  return NextResponse.json({ error: "VIP tier routes are disabled in demo mode" }, { status: 404 });
}

const zBenefit = z.object({
  tier: z.string().min(1),
  benefit: z.string().min(1),
  category: z.string().min(1),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

async function liveGET(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const url = new URL(request.url);
  const tier = url.searchParams.get("tier");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { venueId };
  if (tier) where.tier = tier;

  const benefits = await db.vipTierBenefit.findMany({ where, orderBy: { sortOrder: "asc" } });
  return NextResponse.json(benefits);
}

async function livePOST(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zBenefit.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const benefit = await db.vipTierBenefit.create({ data: { ...parsed.data, venueId } });
  return NextResponse.json(benefit, { status: 201 });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
