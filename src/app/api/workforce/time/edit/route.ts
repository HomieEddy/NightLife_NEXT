import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";
import { apiErrorFromCatch } from "@/features/shared/api-error";

function demoHandler() {
  return NextResponse.json({ error: "Workforce routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest) {
  const { requirePermission } = await import("@/features/platform/permission-guard");
  const { editTimeEntry } = await import("@/features/workforce/time-core");
  const { zEditEntry } = await import("@/features/workforce/workforce-schemas");

  const auth = await requirePermission("staff", "time:edit-others");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = zEditEntry.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { venueId, db } = auth;
  try {
    const entry = await editTimeEntry(
      db, venueId, parsed.data.entryId,
      { clockInAt: parsed.data.clockInAt, clockOutAt: parsed.data.clockOutAt, minutesWorked: parsed.data.minutesWorked },
      parsed.data.editorId, parsed.data.reason,
    );
    return NextResponse.json(entry, { status: 201 });
  } catch (e) {
    return apiErrorFromCatch(e, "Failed to edit time entry");
  }
}

export const POST = isDemoMode() ? demoHandler : livePOST;
