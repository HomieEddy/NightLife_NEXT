import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Tab routes are disabled in demo mode" }, { status: 404 });
}

async function livePATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { requirePermission } = await import("@/features/platform/permission-guard");
  const { reassignOrdersToSession } = await import("@/features/tab/core");
  const { zReassignOrders } = await import("@/features/tab/schemas");

  const auth = await requirePermission("staff", "tab:transfer");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zReassignOrders.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { id } = await params;
  const { venueId, db } = auth;
  const result = await reassignOrdersToSession(db, venueId, id, parsed.data.toSessionId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json(result);
}

export const PATCH = isDemoMode() ? demoHandler : livePATCH;
