"use client";

/**
 * liveIncidentService — plan 17 shipped demo-track only (AD-14). No Prisma
 * models or route handlers exist yet for incident reports; this satisfies
 * mockIncidentService's type so the selector compiles, but every method is
 * unreachable until the live track graduates.
 */
import type { mockIncidentService } from "@/features/safety/mock-service";

function notYetSupported(): never {
  throw new Error("Incidents are not yet supported in the live build — see docs/plans/17-door-arrival-guest-identity-PLAN.md");
}

export const liveIncidentService: typeof mockIncidentService = {
  listIncidents: notYetSupported,
  getIncident: notYetSupported,
  listNotes: notYetSupported,
  reportIncident: notYetSupported,
  addNote: notYetSupported,
  setStatus: notYetSupported,
  markReportable: notYetSupported,
  recordReportedToAuthority: notYetSupported,
  listActionItems: notYetSupported,
  createActionItem: notYetSupported,
  completeActionItem: notYetSupported,
};
