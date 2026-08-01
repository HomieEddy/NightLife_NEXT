import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Order routes are disabled in demo mode" }, { status: 404 });
}

async function livePATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { requirePermission } = await import("@/features/platform/permission-guard");
  const { releaseOrder } = await import("@/features/ordering/core");

  const auth = await requirePermission("staff", "order:release");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { db } = auth;
  const { id } = await params;

  const order = await releaseOrder(db, id);

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(order);
}

export const PATCH = isDemoMode() ? demoHandler : livePATCH;
