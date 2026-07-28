import { z } from "zod";

export const zShiftInput = z.object({
  staffId: z.string().min(1),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  zoneId: z.string().min(1).nullable(),
});
