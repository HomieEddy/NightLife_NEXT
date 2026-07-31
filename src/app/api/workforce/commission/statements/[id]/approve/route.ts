import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Workforce routes are disabled in demo mode" }, { status: 404 });
}

async function livePATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requirePermission } = await import("@/features/platform/permission-guard");
  const { approveCommissionStatement } = await import("@/features/workforce/commission-core");
  const { zApproveStatement } = await import("@/features/workforce/workforce-schemas");

  const auth = await requirePermission("staff", "commission:approve");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zApproveStatement.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { id } = await params;
  const { db } = auth;
  try {
    return NextResponse.json(await approveCommissionStatement(db, id, parsed.data.approverId));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}

export const PATCH = isDemoMode() ? demoHandler : livePATCH;
