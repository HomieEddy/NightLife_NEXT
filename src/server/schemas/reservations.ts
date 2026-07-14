import { z } from "zod";

export const zReservationInput = z.object({
  tableId: z.string().optional(),
  zoneId: z.string().optional(),
  guestName: z.string().min(1),
  partySize: z.number().int().positive(),
  startsAt: z.string().min(1),
  endsAt: z.string().optional(),
  note: z.string().optional(),
  source: z.enum(["manager", "public"]),
});

export const zReservationPatch = z.object({
  tableId: z.string().nullable().optional(),
  zoneId: z.string().nullable().optional(),
  guestName: z.string().min(1).optional(),
  partySize: z.number().int().positive().optional(),
  startsAt: z.string().min(1).optional(),
  endsAt: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

export const zReservationStatus = z.enum([
  "requested",
  "confirmed",
  "seated",
  "cancelled",
  "completed",
]);

export const zListReservations = z.object({
  status: z.array(zReservationStatus).optional(),
  zoneIds: z.array(z.string()).optional(),
  date: z.string().optional(),
});
