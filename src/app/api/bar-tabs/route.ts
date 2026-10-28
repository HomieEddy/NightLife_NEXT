import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";
import { z } from "zod";

function demoHandler() {
  return NextResponse.json({ error: "Bar tab routes are disabled in demo mode" }, { status: 404 });
}

const zBarTab = z.object({
  guestName: z.string().min(1),
  guestProfileId: z.string().optional(),
  staffId: z.string().min(1),
  staffName: z.string().min(1),
});

async function liveGET(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const url = new URL(request.url);
  const status = url.searchParams.get("status") as string | null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { venueId };
  if (status) where.status = status;

  const tabs = await db.barTab.findMany({ where, orderBy: { openedAt: "desc" }, take: 200 });
  return NextResponse.json(tabs);
}

async function livePOST(request: NextRequest) {
  const { requirePermission } = await import("@/features/platform/permission-guard");

  // tab:close-bar is the bar-tab lifecycle action (manager/bartender) — opening
  // a tab creates a money-bearing liability, so a runner cannot.
  const auth = await requirePermission("staff", "tab:close-bar");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zBarTab.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { venueId, db } = auth;

  const tab = await db.barTab.create({
    data: {
      venueId,
      guestName: parsed.data.guestName,
      guestProfileId: parsed.data.guestProfileId ?? null,
      status: "open",
      openedByStaffId: parsed.data.staffId,
      openedByStaffName: parsed.data.staffName,
      openedAt: new Date(),
    },
  });
  return NextResponse.json(tab, { status: 201 });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
