import type { getDb } from "./db";
import type { StaffShift } from "@/lib/types";
import type { z } from "zod";
import type { zShiftInput } from "./schemas/shifts";

type ScopedDb = ReturnType<typeof getDb>;

function toShift(row: {
  id: string;
  staffId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  zoneId: string | null;
}): StaffShift {
  return {
    id: row.id,
    staffId: row.staffId,
    dayOfWeek: row.dayOfWeek,
    startTime: row.startTime,
    endTime: row.endTime,
    zoneId: row.zoneId,
  };
}

export async function listShifts(db: ScopedDb): Promise<StaffShift[]> {
  const rows = await db.staffShift.findMany({ orderBy: { dayOfWeek: "asc" } });
  return rows.map(toShift);
}

export async function addShift(
  db: ScopedDb,
  venueId: string,
  input: z.infer<typeof zShiftInput>,
): Promise<StaffShift> {
  const row = await db.staffShift.create({ data: { ...input, venueId } });
  return toShift(row);
}

export async function removeShift(db: ScopedDb, shiftId: string): Promise<void> {
  await db.staffShift.delete({ where: { id: shiftId } }).catch(() => undefined);
}
