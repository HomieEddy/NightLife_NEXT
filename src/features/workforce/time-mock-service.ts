/**
 * mockTimeService — future backend boundary for time-clock operations (plan 18).
 * TimeEntry rows are append-only (same discipline as StockMovement); edits
 * supersede, never mutate. The manual isOnShift toggle is retired in live builds.
 */
import type { Shift, TimeEntry, TimeOffRequest, ShiftSwapRequest } from "@/lib/types";
import { mockTimeEntries, mockTimeOffRequests, mockShiftSwapRequests } from "@/lib/mock-data/workforce";
import { mockShifts } from "@/lib/mock-data/workforce";
import { clone, delay, uid } from "@/features/shared/delay";

const entries: TimeEntry[] = clone(mockTimeEntries);
const timeOffRequests: TimeOffRequest[] = clone(mockTimeOffRequests);
const swapRequests: ShiftSwapRequest[] = clone(mockShiftSwapRequests);

export const mockTimeService = {
  async listEntries(staffId?: string): Promise<TimeEntry[]> {
    await delay();
    if (staffId) return clone(entries.filter((e) => e.staffId === staffId));
    return clone(entries);
  },

  async clockIn(staffId: string, shiftId?: string): Promise<TimeEntry> {
    await delay(300);
    const open = entries.find((e) => e.staffId === staffId && !e.clockOutAt);
    if (open) throw new Error("Already clocked in — clock out first.");
    const entry: TimeEntry = {
      id: uid("te"),
      venueId: "venue-1",
      shiftId: shiftId,
      staffId,
      clockInAt: new Date().toISOString(),
      breaks: [],
      source: "self",
      minutesWorked: undefined,
    };
    entries.push(entry);
    return clone(entry);
  },

  async clockOut(staffId: string): Promise<TimeEntry> {
    await delay(300);
    const idx = entries.findIndex((e) => e.staffId === staffId && !e.clockOutAt);
    if (idx === -1) throw new Error("No open clock-in found — clock in first.");
    const now = new Date().toISOString();
    const start = new Date(entries[idx].clockInAt!).getTime();
    const end = Date.now();
    let minutes = Math.round((end - start) / 60_000);
    for (const b of entries[idx].breaks) {
      if (!b.endedAt) continue;
      const bMin = (new Date(b.endedAt).getTime() - new Date(b.startedAt).getTime()) / 60_000;
      if (!b.paid) minutes -= bMin;
    }
    entries[idx] = { ...entries[idx], clockOutAt: now, minutesWorked: Math.max(0, Math.round(minutes)) };
    return clone(entries[idx]);
  },

  async startBreak(staffId: string): Promise<TimeEntry> {
    await delay(200);
    const idx = entries.findIndex((e) => e.staffId === staffId && !e.clockOutAt);
    if (idx === -1) throw new Error("Not clocked in.");
    entries[idx] = {
      ...entries[idx],
      breaks: [
        ...entries[idx].breaks,
        { startedAt: new Date().toISOString(), paid: false },
      ],
    };
    return clone(entries[idx]);
  },

  async endBreak(staffId: string): Promise<TimeEntry> {
    await delay(200);
    const idx = entries.findIndex((e) => e.staffId === staffId && !e.clockOutAt);
    if (idx === -1) throw new Error("Not clocked in.");
    const breaks = [...entries[idx].breaks];
    const lastIdx = breaks.length - 1;
    if (lastIdx < 0 || breaks[lastIdx].endedAt) throw new Error("No active break.");
    breaks[lastIdx] = { ...breaks[lastIdx], endedAt: new Date().toISOString() };
    entries[idx] = { ...entries[idx], breaks };
    return clone(entries[idx]);
  },

  async getCurrentEntry(staffId: string): Promise<TimeEntry | null> {
    await delay(100);
    const e = entries.find((e) => e.staffId === staffId && !e.clockOutAt);
    return e ? clone(e) : null;
  },

  /** Manager overrides — writes a new row, never mutates the original (INV-W3). */
  async editEntry(
    entryId: string,
    edits: { clockInAt?: string; clockOutAt?: string; minutesWorked?: number },
    editorId: string,
    reason: string,
  ): Promise<TimeEntry> {
    await delay(300);
    const orig = entries.find((e) => e.id === entryId);
    if (!orig) throw new Error("Entry not found.");
    const superseded: TimeEntry = {
      id: uid("te"),
      venueId: orig.venueId,
      shiftId: orig.shiftId,
      staffId: orig.staffId,
      clockInAt: edits.clockInAt ?? orig.clockInAt!,
      clockOutAt: edits.clockOutAt ?? orig.clockOutAt,
      breaks: orig.breaks,
      source: "manager",
      supersedesId: orig.id,
      editedByStaffId: editorId,
      editReason: reason,
      minutesWorked: edits.minutesWorked ?? orig.minutesWorked,
    };
    entries.push(superseded);
    return clone(superseded);
  },

  // Scheduling

  async listShifts(staffId?: string): Promise<Shift[]> {
    await delay();
    if (staffId) return clone(mockShifts.filter((s) => s.staffId === staffId));
    return clone(mockShifts);
  },

  async publishShifts(shifts: Shift[]): Promise<Shift[]> {
    await delay(400);
    const now = new Date().toISOString();
    const published = shifts.map((s) => ({ ...s, status: "published" as const, publishedAt: now }));
    for (const s of published) {
      const idx = mockShifts.findIndex((ms) => ms.id === s.id);
      if (idx >= 0) mockShifts[idx] = s;
      else mockShifts.push(s);
    }
    return clone(published);
  },

  // Time-off requests

  async listTimeOffRequests(staffId?: string): Promise<TimeOffRequest[]> {
    await delay();
    if (staffId) return clone(timeOffRequests.filter((r) => r.staffId === staffId));
    return clone(timeOffRequests);
  },

  async requestTimeOff(req: Omit<TimeOffRequest, "id" | "status">): Promise<TimeOffRequest> {
    await delay(200);
    const r: TimeOffRequest = { ...req, id: uid("to"), status: "requested" };
    timeOffRequests.push(r);
    return clone(r);
  },

  async approveTimeOff(requestId: string, deciderId: string, approved: boolean): Promise<TimeOffRequest> {
    await delay(200);
    const idx = timeOffRequests.findIndex((r) => r.id === requestId);
    if (idx === -1) throw new Error("Request not found.");
    timeOffRequests[idx] = {
      ...timeOffRequests[idx],
      status: approved ? "approved" : "denied",
      decidedByStaffId: deciderId,
      decidedAt: new Date().toISOString(),
    };
    return clone(timeOffRequests[idx]);
  },

  // Swap requests

  async listSwapRequests(): Promise<ShiftSwapRequest[]> {
    await delay();
    return clone(swapRequests);
  },

  async requestSwap(req: Omit<ShiftSwapRequest, "id">): Promise<ShiftSwapRequest> {
    await delay(200);
    const r: ShiftSwapRequest = { ...req, id: uid("swap") };
    swapRequests.push(r);
    return clone(r);
  },

  async approveSwap(requestId: string, deciderId: string, approved: boolean): Promise<ShiftSwapRequest> {
    await delay(200);
    const idx = swapRequests.findIndex((r) => r.id === requestId);
    if (idx === -1) throw new Error("Swap not found.");
    swapRequests[idx] = {
      ...swapRequests[idx],
      status: approved ? "approved" : "denied",
      decidedByStaffId: deciderId,
    };
    return clone(swapRequests[idx]);
  },

  async claimSwap(requestId: string, staffId: string): Promise<ShiftSwapRequest> {
    await delay(200);
    const idx = swapRequests.findIndex((r) => r.id === requestId);
    if (idx === -1) throw new Error("Swap not found.");
    swapRequests[idx] = { ...swapRequests[idx], status: "claimed", claimedByStaffId: staffId };
    return clone(swapRequests[idx]);
  },
};
