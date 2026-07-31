import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";

function demoHandler() {
  return NextResponse.json({ error: "Order routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest) {
  const { requirePermission } = await import("@/features/platform/permission-guard");
  const { sendGift } = await import("@/features/ordering/core");
  const { zSendGift } = await import("@/features/ordering/schemas");

  const auth = await requirePermission("staff", "order:gift");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zSendGift.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { venueId, db } = auth;

  const result = await sendGift(db, venueId, parsed.data);

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json(result.order, { status: 201 });
}

export const POST = isDemoMode() ? demoHandler : livePOST;
