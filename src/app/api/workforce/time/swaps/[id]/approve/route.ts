import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Workforce routes are disabled in demo mode" }, { status: 404 });
}

async function livePATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requirePermission } = await import("@/features/platform/permission-guard");
  const { approveSwap } = await import("@/features/workforce/time-core");
  const { zApproveSwap } = await import("@/features/workforce/workforce-schemas");

  const auth = await requirePermission("staff", "schedule:approve-swap");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zApproveSwap.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { id } = await params;
  const { db } = auth;
  return NextResponse.json(await approveSwap(db, id, parsed.data.deciderId, parsed.data.approved));
}

export const PATCH = isDemoMode() ? demoHandler : livePATCH;
