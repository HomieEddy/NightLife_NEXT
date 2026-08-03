import { z } from "zod";

export const zCreateSession = z.object({
  tableId: z.string().min(1).max(30),
  tableCode: z.string().min(1).max(20),
  zoneName: z.string().min(1).max(50),
  displayName: z.string().min(1).max(100),
  partySize: z.number().int().positive().max(100),
});

const SESSION_STATUSES = ["pending", "approved", "denied", "closure-requested", "closed", "merged"] as const;

export const zSetSessionStatus = z.object({
  status: z.enum(SESSION_STATUSES),
  settlementMethod: z.enum(["terminal", "cash", "house"]).optional(),
});

const HELP_TYPES = ["call-waiter", "refill-ice", "clean-table", "security", "bill"] as const;

export const zCreateHelpRequest = z.object({
  sessionId: z.string().min(1).max(30),
  tableCode: z.string().min(1).max(20),
  zoneName: z.string().min(1).max(50),
  guestName: z.string().min(1).max(100),
  type: z.enum(HELP_TYPES),
});

const HELP_STATUSES = ["open", "acknowledged", "resolved"] as const;

export const zSetHelpStatus = z.object({
  status: z.enum(HELP_STATUSES),
});
