"use client";

import type { mockTimeService } from "@/features/workforce/time-mock-service";

function notYetSupported(): never {
  throw new Error("Workforce features are not yet supported in the live build — see docs/plans/18-workforce-time-incentives-PLAN.md");
}

export const liveTimeService: typeof mockTimeService = {
  listEntries: notYetSupported,
  clockIn: notYetSupported,
  clockOut: notYetSupported,
  startBreak: notYetSupported,
  endBreak: notYetSupported,
  getCurrentEntry: notYetSupported,
  editEntry: notYetSupported,
  listShifts: notYetSupported,
  publishShifts: notYetSupported,
  listTimeOffRequests: notYetSupported,
  requestTimeOff: notYetSupported,
  approveTimeOff: notYetSupported,
  listSwapRequests: notYetSupported,
  requestSwap: notYetSupported,
  approveSwap: notYetSupported,
  claimSwap: notYetSupported,
};
