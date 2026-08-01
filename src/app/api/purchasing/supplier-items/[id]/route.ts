import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Purchasing routes are disabled in demo mode" }, { status: 404 });
}

async function liveDELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requireApiArea } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { removeSupplierItem } = await import("@/features/platform/purchasing-core");

  const auth = await requireApiArea("manager");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const db = getDb({ venueId: "" });
  await removeSupplierItem(db, id);
  return new NextResponse(null, { status: 204 });
}

export const DELETE = isDemoMode() ? demoHandler : liveDELETE;
