import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Order routes are disabled in demo mode" }, { status: 404 });
}

async function livePATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { rushOrder } = await import("@/features/tab/core");
  const { zRushOrder } = await import("@/features/tab/schemas");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zRushOrder.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { id } = await params;
  const { venueId } = sessionToDbContext(auth.session);
  const order = await rushOrder(getDb({ venueId }), venueId, id, parsed.data.staffName);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  return NextResponse.json(order);
}

export const PATCH = isDemoMode() ? demoHandler : livePATCH;
