"use client";

/**
 * liveGuestService — plan 17 shipped demo-track only (AD-14). No Prisma
 * models or route handlers exist yet for persistent guest identity; this
 * satisfies mockGuestService's type so the selector compiles, but every
 * method is unreachable until the live track graduates.
 */
import type { mockGuestService } from "@/lib/mock-services/guest-service";

function notYetSupported(): never {
  throw new Error("Guest identity is not yet supported in the live build — see docs/plans/17-door-arrival-guest-identity-PLAN.md");
}

export const liveGuestService: typeof mockGuestService = {
  listProfiles: notYetSupported,
  getProfile: notYetSupported,
  findCandidates: notYetSupported,
  searchProfiles: notYetSupported,
  createProfile: notYetSupported,
  updateProfile: notYetSupported,
  setBanStatus: notYetSupported,
  mergeProfiles: notYetSupported,
  getLinkForSession: notYetSupported,
  linkSessionToProfile: notYetSupported,
  listLinks: notYetSupported,
  recordVisit: notYetSupported,
};
