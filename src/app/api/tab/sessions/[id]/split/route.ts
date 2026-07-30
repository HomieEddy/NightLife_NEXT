import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Tab routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { splitBill } = await import("@/features/tab/core");
  const { zSplitBillBody } = await import("@/features/tab/schemas");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zSplitBillBody.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { id } = await params;
  const assignment = await splitBill(getDb({ venueId: sessionToDbContext(auth.session).venueId }), id, parsed.data.splits);
  if (!assignment) return NextResponse.json({ error: "Session not found or not active" }, { status: 404 });
  return NextResponse.json(assignment);
}

export const POST = isDemoMode() ? demoHandler : livePOST;
