import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";
import { z } from "zod";

function demoHandler() {
  return NextResponse.json({ error: "Table routes are disabled in demo mode" }, { status: 404 });
}

const zHold = z.object({
  reason: z.string().min(1),
  heldBy: z.string().min(1),
  heldUntil: z.string().datetime().optional(),
});

async function livePOST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zHold.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { id } = await params;
  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const table = await db.venueTable.findFirst({ where: { id, venueId } });
  if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 });
  if (table.status !== "open") return NextResponse.json({ error: "Table is not available to hold" }, { status: 409 });

  const updated = await db.venueTable.update({
    where: { id },
    data: {
      status: "held",
      holdReason: parsed.data.reason,
      heldBy: parsed.data.heldBy,
      heldUntil: parsed.data.heldUntil ? new Date(parsed.data.heldUntil) : undefined,
    },
  });
  return NextResponse.json(updated);
}

export const POST = isDemoMode() ? demoHandler : livePOST;
