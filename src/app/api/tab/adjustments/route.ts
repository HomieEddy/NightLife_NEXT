import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Tab routes are disabled in demo mode" }, { status: 404 });
}

async function liveGET(request: NextRequest) {
  const { requireApiArea, sessionToDbContext } = await import("@/features/platform/auth-helpers");
  const { getDb } = await import("@/features/shared/db");
  const { listAdjustments } = await import("@/features/tab/core");

  const auth = await requireApiArea("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { venueId } = sessionToDbContext(auth.session);
  const db = getDb({ venueId });

  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId") ?? undefined;

  const adjustments = await listAdjustments(db, sessionId);
  return NextResponse.json(adjustments);
}

async function livePOST(request: NextRequest) {
  const { requireStaffContext } = await import("@/features/platform/permission-guard");
  const { canDo } = await import("@/features/shared/permissions");
  const { createAdjustment } = await import("@/features/tab/core");
  const { zAdjustOrder } = await import("@/features/tab/schemas");

  // Any staff role may adjust a tab, but only for the kinds their role holds
  // (a bartender voids but cannot comp/discount) — gate on the body's kind.
  const auth = await requireStaffContext("staff");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zAdjustOrder.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const action = `tab:${parsed.data.kind}` as const;
  if (!canDo(auth.permissions, auth.staff.role, action)) {
    return NextResponse.json(
      { error: `Role ${auth.staff.role} cannot ${parsed.data.kind} tabs` },
      { status: 403 },
    );
  }

  const { venueId, db } = auth;
  const result = await createAdjustment(db, venueId, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json(result.adjustment, { status: 201 });
}

export const GET = isDemoMode() ? demoHandler : liveGET;
export const POST = isDemoMode() ? demoHandler : livePOST;
