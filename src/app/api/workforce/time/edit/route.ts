import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/features/shared/app-mode";
import { apiErrorFromCatch } from "@/features/shared/api-error";

function demoHandler() {
  return NextResponse.json({ error: "Workforce routes are disabled in demo mode" }, { status: 404 });
}

async function livePOST(request: NextRequest) {
  const { requireStaffContext, isDenied } = await import("@/features/platform/permission-guard");
  const { canDo } = await import("@/features/shared/permissions");
  const { editTimeEntry } = await import("@/features/workforce/time-core");
  const { zEditEntry } = await import("@/features/workforce/workforce-schemas");

  // time:edit-others is scoped to the TARGET entry's owner (notOwnedByActor):
  // resolve the context first, then gate once the row is loaded.
  const ctx = await requireStaffContext("staff");
  if (isDenied(ctx)) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

  const parsed = zEditEntry.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const { venueId, db } = ctx;
  try {
    const entry = await db.timeEntry.findFirst({ where: { id: parsed.data.entryId } });
    if (!entry) return NextResponse.json({ error: "Entry not found." }, { status: 404 });

    if (!canDo(ctx.permissions, ctx.staff.role, "time:edit-others", {
      actor: ctx.actor,
      resource: { ownerStaffId: entry.staffId },
    })) {
      return NextResponse.json(
        { error: `Role ${ctx.staff.role} cannot correct another staff member's time entry` },
        { status: 403 },
      );
    }

    const corrected = await editTimeEntry(
      db, venueId, parsed.data.entryId,
      { clockInAt: parsed.data.clockInAt, clockOutAt: parsed.data.clockOutAt, minutesWorked: parsed.data.minutesWorked },
      parsed.data.editorId, parsed.data.reason,
    );
    return NextResponse.json(corrected, { status: 201 });
  } catch (e) {
    return apiErrorFromCatch(e, "Failed to edit time entry");
  }
}

export const POST = isDemoMode() ? demoHandler : livePOST;
