"use client";

/**
 * liveDoorService — plan 17 shipped demo-track only (AD-14). No Prisma
 * models or route handlers exist yet for occupancy/admissions/coat check;
 * this satisfies mockDoorService's type so the selector compiles, but every
 * method is unreachable until the live track graduates (see plan's
 * Implementation strategy §7-9).
 */
import type { mockDoorService } from "@/lib/mock-services/door-service";

function notYetSupported(): never {
  throw new Error("Door is not yet supported in the live build — see docs/plans/17-door-arrival-guest-identity-PLAN.md");
}

export const liveDoorService: typeof mockDoorService = {
  getOccupancy: notYetSupported,
  listOccupancyEvents: notYetSupported,
  adjustOccupancy: notYetSupported,
  listAdmissions: notYetSupported,
  getAdmission: notYetSupported,
  admit: notYetSupported,
  reEnter: notYetSupported,
  recordExit: notYetSupported,
  admitBannedOverride: notYetSupported,
  listCoatCheckTickets: notYetSupported,
  checkInCoat: notYetSupported,
  claimCoat: notYetSupported,
};
