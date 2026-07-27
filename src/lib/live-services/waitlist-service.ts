"use client";

/**
 * liveWaitlistService — plan 17 shipped demo-track only (AD-14). No Prisma
 * models or route handlers exist yet for the walk-in waitlist; this
 * satisfies mockWaitlistService's type so the selector compiles, but every
 * method is unreachable until the live track graduates.
 */
import type { mockWaitlistService } from "@/lib/mock-services/waitlist-service";

function notYetSupported(): never {
  throw new Error("Waitlist is not yet supported in the live build — see docs/plans/17-door-arrival-guest-identity-PLAN.md");
}

export const liveWaitlistService: typeof mockWaitlistService = {
  listEntries: notYetSupported,
  join: notYetSupported,
  setStatus: notYetSupported,
};
