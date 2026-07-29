/**
 * mockIncidentService — future backend boundary for incident reports
 * (plan 17). The narrative is immutable after submit (INV-D2); follow-ups
 * are appended IncidentNote rows. Writes an AuditEntry in the same logical
 * operation that creates the incident.
 */
import type { Incident, IncidentActionItem, IncidentNote, IncidentTemplate } from "@/lib/types";
import { mockIncidentNotes, mockIncidents } from "@/lib/mock-data/incidents";
import { mockIncidentTemplates } from "@/lib/mock-data/incident-templates";
import { mockVenue } from "@/lib/mock-data/venue";
import { businessDateFor } from "@/lib/door";
import { clone, delay, uid } from "./delay";
import { mockAuditService } from "./audit-service";
import { mockVenueService } from "./venue-service";

let incidents: Incident[] = clone(mockIncidents);
let notes: IncidentNote[] = clone(mockIncidentNotes);
let actionItems: IncidentActionItem[] = [];
let templates: IncidentTemplate[] = clone(mockIncidentTemplates);

export const mockIncidentService = {
  async listIncidents(filter?: {
    type?: Incident["type"];
    severity?: Incident["severity"];
    status?: Incident["status"];
    reportedByStaffId?: string;
  }): Promise<Incident[]> {
    await delay();
    let result = incidents;
    if (filter?.type) result = result.filter((i) => i.type === filter.type);
    if (filter?.severity) result = result.filter((i) => i.severity === filter.severity);
    if (filter?.status) result = result.filter((i) => i.status === filter.status);
    if (filter?.reportedByStaffId) result = result.filter((i) => i.reportedByStaffId === filter.reportedByStaffId);
    return clone(result).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  },

  async getIncident(id: string): Promise<Incident | null> {
    await delay(200);
    return clone(incidents.find((i) => i.id === id) ?? null);
  },

  async listNotes(incidentId: string): Promise<IncidentNote[]> {
    await delay(150);
    return clone(notes.filter((n) => n.incidentId === incidentId)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  /** Narrative is immutable after this call (INV-D2) — writes an AuditEntry in the same step. */
  async reportIncident(input: {
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
  }): Promise<Incident> {
    await delay(500);
    const venue = await mockVenueService.getVenueSnapshot();
    const occurredAt = input.occurredAt ?? new Date().toISOString();
    const incident: Incident = {
      id: uid("inc"),
      venueId: mockVenue.id,
      businessDate: businessDateFor(occurredAt, venue.nightEndHour),
      type: input.type,
      severity: input.severity,
      occurredAt,
      zoneId: input.zoneId,
      tableId: input.tableId,
      locationDescription: input.locationDescription?.trim() || undefined,
      guestProfileId: input.guestProfileId,
      involvedStaffIds: input.involvedStaffIds,
      narrative: input.narrative.trim(),
      actionsTaken: input.actionsTaken.trim(),
      policeInvolved: input.policeInvolved,
      reportedByStaffId: input.reportedByStaffId,
      reportedByStaffName: input.reportedByStaffName,
      status: "open",
      reportable: input.reportable ?? false,
      regulatoryDeadline: input.regulatoryDeadline,
      regulatoryAuthority: input.regulatoryAuthority,
      escalationLevel: input.escalationLevel,
      witnesses: input.witnesses,
      cctvReference: input.cctvReference,
      medicalChecklist: input.medicalChecklist,
    };
    incidents = [incident, ...incidents];
    await mockAuditService.record({
      actorStaffId: input.reportedByStaffId,
      actorName: input.reportedByStaffName,
      action: "incident:create",
      targetType: "incident",
      targetId: incident.id,
      summary: `Filed a ${incident.severity} ${incident.type.replace(/-/g, " ")} incident`,
      metadata: { policeInvolved: incident.policeInvolved },
    });
    return clone(incident);
  },

  async addNote(incidentId: string, note: string, staffId: string, staffName: string): Promise<IncidentNote> {
    await delay(300);
    const entry: IncidentNote = {
      id: uid("in"),
      incidentId,
      note: note.trim(),
      authorStaffId: staffId,
      authorStaffName: staffName,
      createdAt: new Date().toISOString(),
    };
    notes = [...notes, entry];
    return clone(entry);
  },

  async setStatus(id: string, status: Incident["status"]): Promise<Incident | null> {
    await delay(250);
    const incident = incidents.find((i) => i.id === id);
    if (!incident) return null;
    incident.status = status;
    return clone(incident);
  },

  /** S-02: mark an incident as reportable with a regulatory deadline and authority. */
  async markReportable(
    id: string,
    input: { regulatoryDeadline: string; regulatoryAuthority: string; staffId: string; staffName: string },
  ): Promise<Incident | null> {
    await delay(250);
    const incident = incidents.find((i) => i.id === id);
    if (!incident) return null;
    incident.reportable = true;
    incident.regulatoryDeadline = input.regulatoryDeadline;
    incident.regulatoryAuthority = input.regulatoryAuthority;
    await mockAuditService.record({
      actorStaffId: input.staffId,
      actorName: input.staffName,
      action: "incident:mark-reportable",
      targetType: "incident",
      targetId: id,
      summary: `Marked incident as reportable — deadline ${input.regulatoryDeadline}, authority: ${input.regulatoryAuthority}`,
    });
    return clone(incident);
  },

  /** S-02: record that a reportable incident has been filed with the authority. */
  async recordReportedToAuthority(id: string, staffId: string, staffName: string): Promise<Incident | null> {
    await delay(250);
    const incident = incidents.find((i) => i.id === id);
    if (!incident) return null;
    incident.reportedToAuthorityAt = new Date().toISOString();
    await mockAuditService.record({
      actorStaffId: staffId,
      actorName: staffName,
      action: "incident:mark-reportable",
      targetType: "incident",
      targetId: id,
      summary: `Reported incident to ${incident.regulatoryAuthority ?? "regulatory authority"}`,
    });
    return clone(incident);
  },

  /** OE-32: Post-incident action items — created during review as assignable tasks. */
  async listActionItems(incidentId?: string): Promise<IncidentActionItem[]> {
    await delay();
    const all = clone(actionItems);
    return incidentId ? all.filter((a) => a.incidentId === incidentId) : all;
  },

  async createActionItem(input: { incidentId: string; description: string; assignedToStaffId?: string }): Promise<IncidentActionItem> {
    await delay(200);
    const item: IncidentActionItem = { id: uid("ai"), ...input, status: "pending", createdAt: new Date().toISOString() };
    actionItems.push(item);
    return clone(item);
  },

  async completeActionItem(itemId: string): Promise<void> {
    const item = actionItems.find((a) => a.id === itemId);
    if (item) { item.status = "completed"; item.completedAt = new Date().toISOString(); }
  },

  // ── SI-01: Incident location ──────────────────────────────────

  async getIncidentsByZone(zoneId: string, dateRange?: { from: string; to: string }): Promise<Incident[]> {
    await delay();
    let result = incidents.filter((i) => i.zoneId === zoneId);
    if (dateRange) {
      result = result.filter((i) => i.occurredAt >= dateRange.from && i.occurredAt <= dateRange.to);
    }
    return clone(result).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  },

  // ── SI-08: Incident quick-file templates ──────────────────────

  async listTemplates(): Promise<IncidentTemplate[]> {
    await delay();
    return clone(templates.filter((t) => t.isActive));
  },

  async fileFromTemplate(
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
    await delay(400);
    const template = templates.find((t) => t.id === templateId);
    if (!template) throw new Error("Template not found");

    let narrative = template.narrativeTemplate;
    let actionsTaken = template.actionsTakenTemplate;
    for (const [key, value] of Object.entries(placeholders)) {
      const re = new RegExp(`\\{${key}\\}`, "g");
      narrative = narrative.replace(re, value);
      actionsTaken = actionsTaken.replace(re, value);
    }

    return this.reportIncident({
      type: template.type,
      severity: template.severity,
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
  },
};
