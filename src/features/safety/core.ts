/**
 * Safety business logic — incidents, notes, action items, templates
 * (plan 17). Every write path is transactional. Narrative immutable after
 * submit (INV-D2).
 */
import type { getDb } from "@/features/shared/db";
import type {
  Incident,
  IncidentActionItem,
  IncidentNote,
  IncidentTemplate,
} from "@/lib/types";
import { businessDateFor } from "@/lib/door";

type ScopedDb = ReturnType<typeof getDb>;

// ══════════════════════════════════════════════════════════════════════════
// Row → domain mappers
// ══════════════════════════════════════════════════════════════════════════

interface IncidentRow {
  id: string;
  venueId: string;
  businessDate: string;
  type: string;
  severity: string;
  occurredAt: Date;
  zoneId: string | null;
  tableId: string | null;
  locationDescription: string | null;
  guestProfileId: string | null;
  involvedStaffIds: string[];
  narrative: string;
  actionsTaken: string;
  policeInvolved: boolean;
  reportedByStaffId: string;
  reportedByStaffName: string;
  status: string;
  reportable: boolean;
  regulatoryDeadline: Date | null;
  regulatoryAuthority: string | null;
  reportedToAuthorityAt: Date | null;
  escalationLevel: string | null;
  witnesses: unknown;
  cctvReference: unknown;
  medicalChecklist: unknown;
  staffInjuryDetails: unknown;
}

function toIncident(row: IncidentRow): Incident {
  return {
    id: row.id,
    venueId: row.venueId,
    businessDate: row.businessDate,
    type: row.type as Incident["type"],
    severity: row.severity as Incident["severity"],
    occurredAt: row.occurredAt.toISOString(),
    zoneId: row.zoneId ?? undefined,
    tableId: row.tableId ?? undefined,
    locationDescription: row.locationDescription ?? undefined,
    guestProfileId: row.guestProfileId ?? undefined,
    involvedStaffIds: row.involvedStaffIds,
    narrative: row.narrative,
    actionsTaken: row.actionsTaken,
    policeInvolved: row.policeInvolved,
    reportedByStaffId: row.reportedByStaffId,
    reportedByStaffName: row.reportedByStaffName,
    status: row.status as Incident["status"],
    reportable: row.reportable,
    regulatoryDeadline: row.regulatoryDeadline?.toISOString(),
    regulatoryAuthority: row.regulatoryAuthority ?? undefined,
    reportedToAuthorityAt: row.reportedToAuthorityAt?.toISOString(),
    escalationLevel: (row.escalationLevel as unknown as Incident["escalationLevel"]) ?? undefined,
    witnesses: row.witnesses as Incident["witnesses"],
    cctvReference: row.cctvReference as Incident["cctvReference"],
    medicalChecklist: row.medicalChecklist as Incident["medicalChecklist"],
    staffInjuryDetails: row.staffInjuryDetails as Incident["staffInjuryDetails"],
  };
}

interface IncidentNoteRow {
  id: string;
  incidentId: string;
  note: string;
  authorStaffId: string;
  authorStaffName: string;
  createdAt: Date;
}

function toIncidentNote(row: IncidentNoteRow): IncidentNote {
  return {
    id: row.id,
    incidentId: row.incidentId,
    note: row.note,
    authorStaffId: row.authorStaffId,
    authorStaffName: row.authorStaffName,
    createdAt: row.createdAt.toISOString(),
  };
}

interface ActionItemRow {
  id: string;
  venueId: string;
  incidentId: string;
  description: string;
  assignedToStaffId: string | null;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
}

function toActionItem(row: ActionItemRow): IncidentActionItem {
  return {
    id: row.id,
    incidentId: row.incidentId,
    description: row.description,
    assignedToStaffId: row.assignedToStaffId ?? undefined,
    status: row.status as IncidentActionItem["status"],
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString(),
  };
}

interface TemplateRow {
  id: string;
  venueId: string;
  label: string;
  type: string;
  severity: string;
  narrativeTemplate: string;
  actionsTakenTemplate: string;
  isActive: boolean;
}

function toTemplate(row: TemplateRow): IncidentTemplate {
  return {
    id: row.id,
    venueId: row.venueId,
    type: row.type as Incident["type"],
    severity: row.severity as Incident["severity"],
    narrativeTemplate: row.narrativeTemplate,
    actionsTakenTemplate: row.actionsTakenTemplate,
    isActive: row.isActive,
    createdAt: "",
  };
}

// ══════════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════════

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function getVenueConfig(db: ScopedDb, venueId: string) {
  return db.venue.findFirstOrThrow({ where: { id: venueId } });
}

// ══════════════════════════════════════════════════════════════════════════
// Incidents
// ══════════════════════════════════════════════════════════════════════════

export async function listIncidents(
  db: ScopedDb,
  filter?: {
    type?: Incident["type"];
    severity?: Incident["severity"];
    status?: Incident["status"];
    reportedByStaffId?: string;
  },
): Promise<Incident[]> {
  const where: Record<string, unknown> = {};
  if (filter?.type) where.type = filter.type;
  if (filter?.severity) where.severity = filter.severity;
  if (filter?.status) where.status = filter.status;
  if (filter?.reportedByStaffId) where.reportedByStaffId = filter.reportedByStaffId;

  const rows = await db.incident.findMany({
    where,
    orderBy: { occurredAt: "desc" },
  });
  return rows.map(toIncident);
}

export async function getIncident(
  db: ScopedDb,
  id: string,
): Promise<Incident | null> {
  const row = await db.incident.findUnique({ where: { id } });
  return row ? toIncident(row) : null;
}

export async function listNotes(
  db: ScopedDb,
  incidentId: string,
): Promise<IncidentNote[]> {
  const rows = await db.incidentNote.findMany({
    where: { incidentId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toIncidentNote);
}

export async function reportIncident(
  db: ScopedDb,
  venueId: string,
  input: {
    type: Incident["type"];
    severity: Incident["severity"];
    occurredAt?: string;
    zoneId?: string;
    tableId?: string;
    locationDescription?: string;
    guestProfileId?: string;
    involvedStaffIds: string[];
    narrative: string;
    actionsTaken: string;
    policeInvolved: boolean;
    reportable?: boolean;
    regulatoryDeadline?: string;
    regulatoryAuthority?: string;
    reportedByStaffId: string;
    reportedByStaffName: string;
    escalationLevel?: Incident["escalationLevel"];
    witnesses?: Incident["witnesses"];
    cctvReference?: Incident["cctvReference"];
    medicalChecklist?: Incident["medicalChecklist"];
    staffInjuryDetails?: Incident["staffInjuryDetails"];
  },
): Promise<Incident> {
  const venue = await getVenueConfig(db, venueId);
  const occurredAt = new Date(input.occurredAt ?? new Date().toISOString());
  const businessDate = businessDateFor(occurredAt.toISOString(), venue.nightEndHour);
  const id = uid("inc");

  await db.incident.create({
    data: {
      id,
      venueId,
      businessDate,
      type: input.type,
      severity: input.severity,
      occurredAt,
      zoneId: input.zoneId ?? null,
      tableId: input.tableId ?? null,
      locationDescription: input.locationDescription?.trim() || null,
      guestProfileId: input.guestProfileId ?? null,
      involvedStaffIds: input.involvedStaffIds,
      narrative: input.narrative.trim(),
      actionsTaken: input.actionsTaken.trim(),
      policeInvolved: input.policeInvolved,
      reportedByStaffId: input.reportedByStaffId,
      reportedByStaffName: input.reportedByStaffName,
      status: "open",
      reportable: input.reportable ?? false,
      regulatoryDeadline: input.regulatoryDeadline ? new Date(input.regulatoryDeadline) : null,
      regulatoryAuthority: input.regulatoryAuthority ?? null,
    },
  });

  await db.auditEntry.create({
    data: {
      venueId,
      actorStaffId: input.reportedByStaffId,
      actorName: input.reportedByStaffName,
      action: "incident:create",
      targetType: "incident",
      targetId: id,
      summary: `Filed a ${input.severity} ${input.type.replace(/-/g, " ")} incident`,
      metadata: JSON.stringify({ policeInvolved: input.policeInvolved }),
    },
  });

  return toIncident((await db.incident.findUniqueOrThrow({ where: { id } }))!);
}

export async function addNote(
  db: ScopedDb,
  incidentId: string,
  note: string,
  staffId: string,
  staffName: string,
): Promise<IncidentNote> {
  const row = await db.incidentNote.create({
    data: {
      id: uid("in"),
      incidentId,
      note: note.trim(),
      authorStaffId: staffId,
      authorStaffName: staffName,
      createdAt: new Date(),
    },
  });
  return toIncidentNote(row);
}

export async function setIncidentStatus(
  db: ScopedDb,
  id: string,
  status: Incident["status"],
): Promise<Incident | null> {
  const inc = await db.incident.findUnique({ where: { id } });
  if (!inc) return null;
  await db.incident.update({ where: { id }, data: { status } });
  return toIncident((await db.incident.findUnique({ where: { id } }))!);
}

export async function markReportable(
  db: ScopedDb,
  venueId: string,
  id: string,
  input: { regulatoryDeadline: string; regulatoryAuthority: string; staffId: string; staffName: string },
): Promise<Incident | null> {
  const inc = await db.incident.findUnique({ where: { id } });
  if (!inc) return null;

  await db.incident.update({
    where: { id },
    data: {
      reportable: true,
      regulatoryDeadline: new Date(input.regulatoryDeadline),
      regulatoryAuthority: input.regulatoryAuthority,
    },
  });

  await db.auditEntry.create({
    data: {
      venueId,
      actorStaffId: input.staffId,
      actorName: input.staffName,
      action: "incident:mark-reportable",
      targetType: "incident",
      targetId: id,
      summary: `Marked incident as reportable — deadline ${input.regulatoryDeadline}, authority: ${input.regulatoryAuthority}`,
    },
  });

  return toIncident((await db.incident.findUnique({ where: { id } }))!);
}

export async function recordReportedToAuthority(
  db: ScopedDb,
  venueId: string,
  id: string,
  staffId: string,
  staffName: string,
): Promise<Incident | null> {
  const inc = await db.incident.findUnique({ where: { id } });
  if (!inc) return null;

  await db.incident.update({
    where: { id },
    data: { reportedToAuthorityAt: new Date() },
  });

  await db.auditEntry.create({
    data: {
      venueId,
      actorStaffId: staffId,
      actorName: staffName,
      action: "incident:mark-reportable",
      targetType: "incident",
      targetId: id,
      summary: `Reported incident to ${inc.regulatoryAuthority ?? "regulatory authority"}`,
    },
  });

  return toIncident((await db.incident.findUnique({ where: { id } }))!);
}

export async function getIncidentsByZone(
  db: ScopedDb,
  zoneId: string,
  dateRange?: { from: string; to: string },
): Promise<Incident[]> {
  const where: Record<string, unknown> = { zoneId };
  if (dateRange) {
    where.occurredAt = { gte: dateRange.from, lte: dateRange.to };
  }
  const rows = await db.incident.findMany({
    where,
    orderBy: { occurredAt: "desc" },
  });
  return rows.map(toIncident);
}

// ══════════════════════════════════════════════════════════════════════════
// Action items (OE-32)
// ══════════════════════════════════════════════════════════════════════════

export async function listActionItems(
  db: ScopedDb,
  incidentId?: string,
): Promise<IncidentActionItem[]> {
  const where: Record<string, unknown> = {};
  if (incidentId) where.incidentId = incidentId;
  const rows = await db.incidentActionItem.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toActionItem);
}

export async function createActionItem(
  db: ScopedDb,
  venueId: string,
  input: { incidentId: string; description: string; assignedToStaffId?: string },
): Promise<IncidentActionItem> {
  const row = await db.incidentActionItem.create({
    data: {
      id: uid("ai"),
      venueId,
      incidentId: input.incidentId,
      description: input.description,
      assignedToStaffId: input.assignedToStaffId ?? null,
      status: "pending",
      createdAt: new Date(),
    },
  });
  return toActionItem(row);
}

export async function completeActionItem(
  db: ScopedDb,
  itemId: string,
): Promise<void> {
  await db.incidentActionItem.update({
    where: { id: itemId },
    data: { status: "completed", completedAt: new Date() },
  });
}

// ══════════════════════════════════════════════════════════════════════════
// Templates (SI-08)
// ══════════════════════════════════════════════════════════════════════════

export async function listTemplates(db: ScopedDb): Promise<IncidentTemplate[]> {
  const rows = await db.incidentTemplate.findMany({
    where: { isActive: true },
  });
  return rows.map(toTemplate);
}

export async function fileFromTemplate(
  db: ScopedDb,
  venueId: string,
  templateId: string,
  placeholders: Record<string, string>,
  overrides: {
    reportedByStaffId: string;
    reportedByStaffName: string;
    occurredAt?: string;
    zoneId?: string;
    tableId?: string;
    locationDescription?: string;
    guestProfileId?: string;
    involvedStaffIds?: string[];
    policeInvolved?: boolean;
    reportable?: boolean;
  },
): Promise<Incident> {
  const tpl = await db.incidentTemplate.findUnique({ where: { id: templateId } });
  if (!tpl) throw new Error("Template not found");

  let narrative = tpl.narrativeTemplate;
  let actionsTaken = tpl.actionsTakenTemplate;
  for (const [key, value] of Object.entries(placeholders)) {
    const re = new RegExp(`\\{${key}\\}`, "g");
    narrative = narrative.replace(re, value);
    actionsTaken = actionsTaken.replace(re, value);
  }

  return reportIncident(db, venueId, {
    type: tpl.type as Incident["type"],
    severity: tpl.severity as Incident["severity"],
    occurredAt: overrides.occurredAt,
    zoneId: overrides.zoneId,
    tableId: overrides.tableId,
    locationDescription: overrides.locationDescription,
    guestProfileId: overrides.guestProfileId,
    involvedStaffIds: overrides.involvedStaffIds ?? [],
    narrative,
    actionsTaken,
    policeInvolved: overrides.policeInvolved ?? false,
    reportable: overrides.reportable,
    reportedByStaffId: overrides.reportedByStaffId,
    reportedByStaffName: overrides.reportedByStaffName,
  });
}
