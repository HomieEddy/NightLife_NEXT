"use client";

import type { mockTipsService } from "@/features/workforce/tips-mock-service";

function notYetSupported(): never {
  throw new Error("Tips are not yet supported in the live build — see docs/plans/18-workforce-time-incentives-PLAN.md");
}

export const liveTipsService: typeof mockTipsService = {
  getRule: notYetSupported,
  saveRule: notYetSupported,
  listDistributions: notYetSupported,
  getDistribution: notYetSupported,
  saveDistribution: notYetSupported,
  closeDistribution: notYetSupported,
};
