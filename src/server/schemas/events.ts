import { z } from "zod";

export const zEventInput = z.object({
  name: z.string().min(1),
  description: z.string(),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  zoneId: z.string().optional(),
  capacity: z.number().int().positive(),
  status: z.enum(["draft", "published", "live", "ended"]),
  guestlistEnabled: z.boolean(),
});

export const zEventPatch = zEventInput.partial();

export const zEventGuestInput = z.object({
  eventId: z.string().min(1),
  name: z.string().min(1),
  partySize: z.number().int().positive(),
});
