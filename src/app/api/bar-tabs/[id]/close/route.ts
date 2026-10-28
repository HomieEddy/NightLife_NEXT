import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";
import { transition } from "@/features/inventory/ledger";

function demoHandler() {
  return NextResponse.json({ error: "Bar tab routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { requirePermission } = await import("@/features/platform/permission-guard");

  // tab:close-bar settles a bar tab (money) — manager or bartender only.
  const auth = await requirePermission("staff", "tab:close-bar");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { venueId, db } = auth;

  const { id } = await params;

  const tab = await db.barTab.findFirst({ where: { id, venueId } });
  if (!tab) return NextResponse.json({ error: "Bar tab not found" }, { status: 404 });

  // CAS on the status — a concurrent close (or double-click) loses exactly once.
  const closed = await db.$transaction(async (tx) => {
    const claimed = await transition(tx, "barTab", id, {
      from: "open",
      to: "closed",
      data: { closedAt: new Date() },
    });
    if (!claimed) return null;
    return tx.barTab.findFirst({ where: { id, venueId } });
  });
  if (!closed) return NextResponse.json({ error: "Bar tab is already closed" }, { status: 409 });
  return NextResponse.json(closed);
}

export const POST = isDemoMode() ? demoHandler : livePOST;
