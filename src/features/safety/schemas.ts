/**
 * Zod schemas for incident reporting, notes, action items & templates
 * (plan 17).
 */
import { z } from "zod";

// ── Incidents ─────────────────────────────────────────────────────────────

export const zReportIncident = z.object({
  type: z.string().min(1),
  severity: z.string().min(1),
  occurredAt: z.string().optional(),
  zoneId: z.string().optional(),
  tableId: z.string().optional(),
  locationDescription: z.string().optional(),
  guestProfileId: z.string().optional(),
  involvedStaffIds: z.array(z.string()).default([]),
  narrative: z.string().min(1),
  actionsTaken: z.string().min(1),
  policeInvolved: z.boolean().default(false),
  reportable: z.boolean().optional(),
  regulatoryDeadline: z.string().optional(),
  regulatoryAuthority: z.string().optional(),
  reportedByStaffId: z.string().min(1),
  reportedByStaffName: z.string().min(1),
  escalationLevel: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
  witnesses: z
    .array(z.object({ name: z.string(), contact: z.string().optional(), statement: z.string() }))
    .optional(),
  cctvReference: z
    .array(z.object({ camera: z.string(), timestamp: z.string() }))
    .optional(),
  medicalChecklist: z
    .object({
      ambulanceCalled: z.boolean(),
      paramedicsArrivedAt: z.string().optional(),
      transportTo: z.string().optional(),
      reportFiled: z.boolean(),
    })
    .optional(),
  staffInjuryDetails: z
    .object({
      staffId: z.string(),
      injuryType: z.string(),
      injuryDescription: z.string(),
      treatmentProvided: z.string(),
      hospitalVisitRequired: z.boolean(),
      workersCompFiled: z.boolean(),
    })
    .optional(),
});

export const zAddNote = z.object({
  note: z.string().min(1),
  staffId: z.string().min(1),
  staffName: z.string().min(1),
});

export const zSetIncidentStatus = z.object({
  status: z.enum(["open", "investigating", "resolved", "closed"]),
});

export const zMarkReportable = z.object({
  regulatoryDeadline: z.string().min(1),
  regulatoryAuthority: z.string().min(1),
  staffId: z.string().min(1),
  staffName: z.string().min(1),
});

export const zRecordReportedToAuthority = z.object({
  staffId: z.string().min(1),
  staffName: z.string().min(1),
});

export const zGetIncidentsByZone = z.object({
  zoneId: z.string().min(1),
  from: z.string().optional(),
  to: z.string().optional(),
});

// ── Action items ──────────────────────────────────────────────────────────

export const zCreateActionItem = z.object({
  incidentId: z.string().min(1),
  description: z.string().min(1),
  assignedToStaffId: z.string().optional(),
});

// ── Templates ─────────────────────────────────────────────────────────────

export const zFileFromTemplate = z.object({
  placeholders: z.record(z.string(), z.string()),
  reportedByStaffId: z.string().min(1),
  reportedByStaffName: z.string().min(1),
  occurredAt: z.string().optional(),
  zoneId: z.string().optional(),
  tableId: z.string().optional(),
  locationDescription: z.string().optional(),
  guestProfileId: z.string().optional(),
  involvedStaffIds: z.array(z.string()).optional(),
  policeInvolved: z.boolean().optional(),
  reportable: z.boolean().optional(),
});
