import type { getDb } from "@/features/shared/db";
import type { ShiftHandoff, StaffTableAssignment } from "@/lib/types";

type ScopedDb = ReturnType<typeof getDb>;

// ── Table assignments ──────────────────────────────────────────────

function dbAssignmentToAssignment(row: {
  id: string; venueId: string; staffId: string; tableIds: string[];
  zoneId: string; shiftId: string | null; assignedAt: Date;
}): StaffTableAssignment {
  return {
    id: row.id, venueId: row.venueId, staffId: row.staffId,
    tableIds: row.tableIds, zoneId: row.zoneId,
    shiftId: row.shiftId ?? undefined, assignedAt: row.assignedAt.toISOString(),
  };
}

export async function assignTables(
  db: ScopedDb, venueId: string, staffId: string, tableIds: string[], zoneId: string, shiftId?: string,
): Promise<StaffTableAssignment> {
  const existing = await db.staffTableAssignment.findFirst({ where: { venueId, staffId, zoneId } });
  if (existing) {
    const row = await db.staffTableAssignment.update({
      where: { id: existing.id }, data: { tableIds, shiftId: shiftId ?? null },
    });
    return dbAssignmentToAssignment(row);
  }
  const row = await db.staffTableAssignment.create({
    data: { venueId, staffId, tableIds, zoneId, shiftId: shiftId ?? null },
  });
  return dbAssignmentToAssignment(row);
}

export async function getTableAssignment(
  db: ScopedDb, venueId: string, staffId: string,
): Promise<StaffTableAssignment | null> {
  const row = await db.staffTableAssignment.findFirst({ where: { venueId, staffId } });
  return row ? dbAssignmentToAssignment(row) : null;
}

export async function getAssignedStaff(
  db: ScopedDb, venueId: string, tableId: string,
): Promise<StaffTableAssignment[]> {
  const rows = await db.staffTableAssignment.findMany({
    where: { venueId, tableIds: { has: tableId } },
  });
  return rows.map(dbAssignmentToAssignment);
}

// ── Shift handoffs ─────────────────────────────────────────────────

function dbHandoffToHandoff(row: {
  id: string; venueId: string; businessDate: string; fromStaffId: string; fromStaffName: string;
  toStaffId: string | null; toStaffName: string | null; openIncidents: string[];
  vipNotes: string; inventoryAlerts: string; specialInstructions: string;
  generatedAt: Date; acknowledgedByStaffId: string | null;
  acknowledgedByStaffName: string | null; acknowledgedAt: Date | null;
}): ShiftHandoff {
  return {
    id: row.id, venueId: row.venueId, businessDate: row.businessDate,
    fromStaffId: row.fromStaffId, fromStaffName: row.fromStaffName,
    toStaffId: row.toStaffId ?? undefined, toStaffName: row.toStaffName ?? undefined,
    openIncidents: row.openIncidents, vipNotes: row.vipNotes,
    inventoryAlerts: row.inventoryAlerts, specialInstructions: row.specialInstructions,
    generatedAt: row.generatedAt.toISOString(),
    acknowledgedByStaffId: row.acknowledgedByStaffId ?? undefined,
    acknowledgedByStaffName: row.acknowledgedByStaffName ?? undefined,
    acknowledgedAt: row.acknowledgedAt?.toISOString(),
  };
}

export async function generateHandoff(
  db: ScopedDb, venueId: string,
  input: {
    fromStaffId: string; fromStaffName: string; toStaffId?: string; toStaffName?: string;
    openIncidents: string[]; vipNotes: string; inventoryAlerts: string; specialInstructions: string;
  },
): Promise<ShiftHandoff> {
  const businessDate = new Date().toISOString().split("T")[0];
  const row = await db.shiftHandoff.create({
    data: {
      venueId, businessDate, fromStaffId: input.fromStaffId, fromStaffName: input.fromStaffName,
      toStaffId: input.toStaffId ?? null, toStaffName: input.toStaffName ?? null,
      openIncidents: input.openIncidents, vipNotes: input.vipNotes,
      inventoryAlerts: input.inventoryAlerts, specialInstructions: input.specialInstructions,
    },
  });
  return dbHandoffToHandoff(row);
}

export async function acknowledgeHandoff(
  db: ScopedDb, handoffId: string, staffId: string, staffName: string,
): Promise<ShiftHandoff | null> {
  const existing = await db.shiftHandoff.findUnique({ where: { id: handoffId } });
  if (!existing) return null;
  const row = await db.shiftHandoff.update({
    where: { id: handoffId },
    data: { acknowledgedByStaffId: staffId, acknowledgedByStaffName: staffName, acknowledgedAt: new Date() },
  });
  return dbHandoffToHandoff(row);
}

export async function listHandoffs(
  db: ScopedDb, venueId: string,
): Promise<ShiftHandoff[]> {
  const rows = await db.shiftHandoff.findMany({
    where: { venueId }, orderBy: { generatedAt: "desc" },
  });
  return rows.map(dbHandoffToHandoff);
}
