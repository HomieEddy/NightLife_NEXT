import type { getDb } from "@/features/shared/db";
import { Prisma } from "@prisma/client";
import type { BreakEntry, Shift, ShiftTemplate, TimeEntry, TimeOffRequest, ShiftSwapRequest } from "@/lib/types";

type ScopedDb = ReturnType<typeof getDb>;

// ── Pure functions (unit-testable) ──────────────────────────────────

/**
 * Compute actual minutes worked: total elapsed minus unpaid break minutes.
 * Rounds to the nearest minute at the end, not per-break.
 */
export function computeMinutesWorked(
  clockInAt: Date,
  clockOutAt: Date,
  breaks: BreakEntry[],
): number {
  const totalMs = clockOutAt.getTime() - clockInAt.getTime();
  let unpaidBreakMs = 0;
  for (const b of breaks) {
    if (!b.endedAt) continue; // open break — not counted yet
    if (b.paid) continue;
    unpaidBreakMs += new Date(b.endedAt).getTime() - new Date(b.startedAt).getTime();
  }
  const workedMs = Math.max(0, totalMs - unpaidBreakMs);
  return Math.max(0, Math.round(workedMs / 60_000));
}

/**
 * Which business date does this shift belong to?
 * A shift starting 22:00 Friday and ending 04:00 Saturday is ONE shift on
 * Friday's business date — the date of the shift start, adjusted for
 * nightStartHour so early-morning hours bill to the previous calendar day.
 */
export function businessDateForShift(shiftStart: Date, nightStartHour: number): string {
  // Use UTC methods to avoid timezone skew between getHours() (local) and
  // toISOString() (always UTC). The caller must pass a Date whose UTC hours
  // represent the venue's local time.
  const d = new Date(shiftStart);
  if (d.getUTCHours() < nightStartHour) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d.toISOString().split("T")[0];
}

/** Is this a shift that spans midnight (start > end in clock time)? */
export function isOvernightShift(startTime: string, endTime: string): boolean {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  return endMin <= startMin; // e.g. 22:00 → 04:00
}

/**
 * Generate dated Shift instances from recurring ShiftTemplates for one week.
 * Resulting shifts always have status "draft", even if the template existed
 * previously — publishing is a separate, explicit manager action.
 */
export function generateShiftsFromTemplates(
  templates: ShiftTemplate[],
  weekStart: Date,
  nightStartHour: number,
): Shift[] {
  const shifts: Shift[] = [];
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + dayOffset);
    const dayOfWeek = date.getDay();

    for (const tpl of templates.filter((t) => t.dayOfWeek === dayOfWeek && t.active)) {
      const shiftDate = new Date(date);
      // If the shift starts in the overnight period (before nightStartHour),
      // it bills to the previous business date.
      const [sh] = tpl.startTime.split(":").map(Number);
      if (sh < nightStartHour) {
        shiftDate.setDate(shiftDate.getDate() + 1);
      }
      shifts.push({
        id: "", // placeholder — assigned at persistence
        venueId: tpl.venueId,
        staffId: tpl.staffId,
        businessDate: shiftDate.toISOString().split("T")[0],
        scheduledStart: tpl.startTime,
        scheduledEnd: tpl.endTime,
        zoneId: tpl.zoneId,
        role: tpl.role ?? "runner",
        status: "draft",
        templateId: tpl.id,
      });
    }
  }
  return shifts;
}

// ── DB-backed functions (server-side, called by route handlers) ────

function dbTimeEntryToEntry(row: {
  id: string;
  venueId: string;
  shiftId: string | null;
  staffId: string;
  clockInAt: Date;
  clockOutAt: Date | null;
  breaks: unknown;
  source: string;
  supersedesId: string | null;
  editedByStaffId: string | null;
  editReason: string | null;
  minutesWorked: number | null;
}): TimeEntry {
  return {
    id: row.id,
    venueId: row.venueId,
    shiftId: row.shiftId ?? undefined,
    staffId: row.staffId,
    clockInAt: row.clockInAt.toISOString(),
    clockOutAt: row.clockOutAt?.toISOString() ?? undefined,
    breaks: (Array.isArray(row.breaks) ? row.breaks : []) as unknown as BreakEntry[],
    source: row.source as "self" | "manager",
    supersedesId: row.supersedesId ?? undefined,
    editedByStaffId: row.editedByStaffId ?? undefined,
    editReason: row.editReason ?? undefined,
    minutesWorked: row.minutesWorked ?? undefined,
  };
}

export async function listTimeEntries(
  db: ScopedDb,
  staffId?: string,
): Promise<TimeEntry[]> {
  const rows = await db.timeEntry.findMany({
    where: staffId ? { staffId } : undefined,
    orderBy: { clockInAt: "desc" },
  });
  return rows.map(dbTimeEntryToEntry);
}

/** INV-W1: at most one open TimeEntry per staff member — enforced here, not in a handler. */
export async function clockIn(
  db: ScopedDb,
  venueId: string,
  staffId: string,
  shiftId?: string,
): Promise<TimeEntry> {
  const open = await db.timeEntry.findFirst({
    where: { staffId, clockOutAt: null },
  });
  if (open) throw new Error("Already clocked in — clock out first.");

  const row = await db.timeEntry.create({
    data: {
      venueId,
      staffId,
      shiftId: shiftId ?? null,
      clockInAt: new Date(),
      breaks: [],
      source: "self",
    },
  });
  return dbTimeEntryToEntry(row);
}

export async function clockOut(
  db: ScopedDb,
  venueId: string,
  staffId: string,
): Promise<TimeEntry> {
  const open = await db.timeEntry.findFirst({
    where: { staffId, clockOutAt: null },
  });
  if (!open) throw new Error("No open clock-in found — clock in first.");

  const now = new Date();
  const breaks = (Array.isArray(open.breaks) ? open.breaks : []) as unknown as unknown as BreakEntry[];
  const minutesWorked = computeMinutesWorked(new Date(open.clockInAt), now, breaks);

  const row = await db.timeEntry.update({
    where: { id: open.id },
    data: { clockOutAt: now, minutesWorked },
  });
  return dbTimeEntryToEntry(row);
}

export async function startBreak(
  db: ScopedDb,
  venueId: string,
  staffId: string,
): Promise<TimeEntry> {
  const open = await db.timeEntry.findFirst({
    where: { staffId, clockOutAt: null },
  });
  if (!open) throw new Error("Not clocked in.");

  const breaks = (Array.isArray(open.breaks) ? open.breaks : []) as unknown as BreakEntry[];
  const newBreak: BreakEntry = { startedAt: new Date().toISOString(), paid: false };
  const updated = await db.timeEntry.update({
    where: { id: open.id },
    data: { breaks: [...breaks, newBreak] },
  });
  return dbTimeEntryToEntry(updated);
}

export async function endBreak(
  db: ScopedDb,
  venueId: string,
  staffId: string,
): Promise<TimeEntry> {
  const open = await db.timeEntry.findFirst({
    where: { staffId, clockOutAt: null },
  });
  if (!open) throw new Error("Not clocked in.");

  const breaks = (Array.isArray(open.breaks) ? open.breaks : []) as unknown as BreakEntry[];
  const lastIdx = breaks.length - 1;
  if (lastIdx < 0 || breaks[lastIdx].endedAt) throw new Error("No active break.");

  breaks[lastIdx] = { ...breaks[lastIdx], endedAt: new Date().toISOString() };
  const updated = await db.timeEntry.update({
    where: { id: open.id },
    data: { breaks },
  });
  return dbTimeEntryToEntry(updated);
}

export async function getCurrentTimeEntry(
  db: ScopedDb,
  staffId: string,
): Promise<TimeEntry | null> {
  const row = await db.timeEntry.findFirst({
    where: { staffId, clockOutAt: null },
  });
  return row ? dbTimeEntryToEntry(row) : null;
}

/**
 * INV-W3: Manager edit creates a NEW row (supersedesId) — the original is
 * never mutated. The new row has source "manager" and a mandatory reason.
 */
export async function editTimeEntry(
  db: ScopedDb,
  venueId: string,
  entryId: string,
  edits: { clockInAt?: string; clockOutAt?: string; minutesWorked?: number },
  editorId: string,
  reason: string,
): Promise<TimeEntry> {
  const orig = await db.timeEntry.findFirst({ where: { id: entryId } });
  if (!orig) throw new Error("Entry not found.");

  const row = await db.timeEntry.create({
    data: {
      venueId,
      staffId: orig.staffId,
      shiftId: orig.shiftId,
      clockInAt: edits.clockInAt ? new Date(edits.clockInAt) : orig.clockInAt,
      clockOutAt: edits.clockOutAt ? new Date(edits.clockOutAt) : orig.clockOutAt,
      breaks: (orig.breaks as object) as Prisma.InputJsonValue,
      source: "manager",
      supersedesId: orig.id,
      editedByStaffId: editorId,
      editReason: reason,
      minutesWorked: edits.minutesWorked ?? orig.minutesWorked,
    },
  });
  return dbTimeEntryToEntry(row);
}

// ── Shifts (dated instances, plan 18) ──────────────────────────────

function dbShiftToShift(row: {
  id: string;
  venueId: string;
  staffId: string;
  businessDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  zoneId: string | null;
  role: string;
  status: string;
  templateId: string | null;
  publishedAt: Date | null;
  note: string | null;
}): Shift {
  return {
    id: row.id,
    venueId: row.venueId,
    staffId: row.staffId,
    businessDate: row.businessDate,
    scheduledStart: row.scheduledStart,
    scheduledEnd: row.scheduledEnd,
    zoneId: row.zoneId,
    role: row.role as Shift["role"],
    status: row.status as Shift["status"],
    templateId: row.templateId ?? undefined,
    publishedAt: row.publishedAt?.toISOString(),
    note: row.note ?? undefined,
  };
}

export async function listShifts(
  db: ScopedDb,
  staffId?: string,
): Promise<Shift[]> {
  const rows = await db.shift.findMany({
    where: staffId ? { staffId } : undefined,
    orderBy: [{ businessDate: "asc" }, { scheduledStart: "asc" }],
  });
  return rows.map(dbShiftToShift);
}

/**
 * INV-W4: published shifts cannot be deleted, only cancelled.
 * The delete guard is in the route handler — this function only sets status.
 */
export async function publishShifts(
  db: ScopedDb,
  shiftIds: string[],
): Promise<Shift[]> {
  const now = new Date();
  // Publish in a transaction: set all to published at once
  await db.$transaction(
    shiftIds.map((id) =>
      db.shift.update({
        where: { id },
        data: { status: "published", publishedAt: now },
      }),
    ),
  );
  const rows = await db.shift.findMany({
    where: { id: { in: shiftIds } },
  });
  return rows.map(dbShiftToShift);
}

export async function saveGeneratedShifts(
  db: ScopedDb,
  shifts: Shift[],
): Promise<Shift[]> {
  const rows = await Promise.all(
    shifts.map((s) =>
      db.shift.create({
        data: {
          venueId: s.venueId,
          staffId: s.staffId,
          businessDate: s.businessDate,
          scheduledStart: s.scheduledStart,
          scheduledEnd: s.scheduledEnd,
          zoneId: s.zoneId,
          role: s.role,
          status: s.status,
          templateId: s.templateId,
        },
      }),
    ),
  );
  return rows.map(dbShiftToShift);
}

/** Cancel a shift — allowed for any non-completed shift. */
export async function cancelShift(
  db: ScopedDb,
  shiftId: string,
): Promise<Shift> {
  const row = await db.shift.update({
    where: { id: shiftId },
    data: { status: "cancelled" },
  });
  return dbShiftToShift(row);
}

// ── Time-off requests ──────────────────────────────────────────────

function dbTimeOffToTimeOff(row: {
  id: string;
  venueId: string;
  staffId: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  decidedByStaffId: string | null;
  decidedAt: Date | null;
}): TimeOffRequest {
  return {
    id: row.id,
    venueId: row.venueId,
    staffId: row.staffId,
    startDate: row.startDate,
    endDate: row.endDate,
    reason: row.reason,
    status: row.status as TimeOffRequest["status"],
    decidedByStaffId: row.decidedByStaffId ?? undefined,
    decidedAt: row.decidedAt?.toISOString(),
  };
}

export async function listTimeOffRequests(
  db: ScopedDb,
  staffId?: string,
): Promise<TimeOffRequest[]> {
  const rows = await db.timeOffRequest.findMany({
    where: staffId ? { staffId } : undefined,
    orderBy: { startDate: "desc" },
  });
  return rows.map(dbTimeOffToTimeOff);
}

export async function requestTimeOff(
  db: ScopedDb,
  input: { venueId: string; staffId: string; startDate: string; endDate: string; reason: string },
): Promise<TimeOffRequest> {
  const row = await db.timeOffRequest.create({
    data: { ...input, status: "requested" },
  });
  return dbTimeOffToTimeOff(row);
}

export async function approveTimeOff(
  db: ScopedDb,
  requestId: string,
  deciderId: string,
  approved: boolean,
): Promise<TimeOffRequest> {
  const row = await db.timeOffRequest.update({
    where: { id: requestId },
    data: {
      status: approved ? "approved" : "denied",
      decidedByStaffId: deciderId,
      decidedAt: new Date(),
    },
  });
  return dbTimeOffToTimeOff(row);
}

// ── Swap requests ─────────────────────────────────────────────────

function dbSwapToSwap(row: {
  id: string;
  venueId: string;
  shiftId: string;
  requestedByStaffId: string;
  offeredToStaffId: string | null;
  status: string;
  claimedByStaffId: string | null;
  decidedByStaffId: string | null;
}): ShiftSwapRequest {
  return {
    id: row.id,
    venueId: row.venueId,
    shiftId: row.shiftId,
    requestedByStaffId: row.requestedByStaffId,
    offeredToStaffId: row.offeredToStaffId ?? undefined,
    status: row.status as ShiftSwapRequest["status"],
    claimedByStaffId: row.claimedByStaffId ?? undefined,
    decidedByStaffId: row.decidedByStaffId ?? undefined,
  };
}

export async function listSwapRequests(
  db: ScopedDb,
): Promise<ShiftSwapRequest[]> {
  const rows = await db.shiftSwapRequest.findMany({
    orderBy: { id: "desc" },
  });
  return rows.map(dbSwapToSwap);
}

export async function requestSwap(
  db: ScopedDb,
  input: {
    venueId: string;
    shiftId: string;
    requestedByStaffId: string;
    offeredToStaffId?: string;
  },
): Promise<ShiftSwapRequest> {
  const row = await db.shiftSwapRequest.create({
    data: { ...input, status: "open" },
  });
  return dbSwapToSwap(row);
}

export async function approveSwap(
  db: ScopedDb,
  requestId: string,
  deciderId: string,
  approved: boolean,
): Promise<ShiftSwapRequest> {
  const row = await db.shiftSwapRequest.update({
    where: { id: requestId },
    data: {
      status: approved ? "approved" : "denied",
      decidedByStaffId: deciderId,
    },
  });
  return dbSwapToSwap(row);
}

export async function claimSwap(
  db: ScopedDb,
  requestId: string,
  staffId: string,
): Promise<ShiftSwapRequest> {
  const row = await db.shiftSwapRequest.update({
    where: { id: requestId },
    data: { status: "claimed", claimedByStaffId: staffId },
  });
  return dbSwapToSwap(row);
}
