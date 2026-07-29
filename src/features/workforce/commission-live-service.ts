"use client";

import type { mockCommissionService } from "@/features/workforce/commission-mock-service";

function notYetSupported(): never {
  throw new Error("Commission is not yet supported in the live build — see docs/plans/18-workforce-time-incentives-PLAN.md");
}

export const liveCommissionService: typeof mockCommissionService = {
  listRules: notYetSupported,
  saveRule: notYetSupported,
  listStatements: notYetSupported,
  saveStatement: notYetSupported,
  approveStatement: notYetSupported,
};
