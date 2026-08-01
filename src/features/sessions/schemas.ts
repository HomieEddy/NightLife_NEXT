import { z } from "zod";

export const zCreateSession = z.object({
  tableId: z.string().min(1),
  tableCode: z.string().min(1),
  zoneName: z.string().min(1),
  displayName: z.string().min(1),
  partySize: z.number().int().positive(),
});

const SESSION_STATUSES = ["pending", "approved", "denied", "closure-requested", "closed", "merged"] as const;

export const zSetSessionStatus = z.object({
  status: z.enum(SESSION_STATUSES),
  settlementMethod: z.enum(["terminal", "cash", "house"]).optional(),
});

const HELP_TYPES = ["call-waiter", "refill-ice", "clean-table", "security", "bill"] as const;

export const zCreateHelpRequest = z.object({
  sessionId: z.string().min(1),
  tableCode: z.string().min(1),
  zoneName: z.string().min(1),
  guestName: z.string().min(1),
  type: z.enum(HELP_TYPES),
});

const HELP_STATUSES = ["open", "acknowledged", "resolved"] as const;

export const zSetHelpStatus = z.object({
  status: z.enum(HELP_STATUSES),
});
