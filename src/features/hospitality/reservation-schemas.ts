import { z } from "zod";

export const zReservationChannel = z.enum(["embed", "direct", "walk-in", "promoter"]);

export const zReservationInput = z.object({
  tableId: z.string().optional(),
  zoneId: z.string().optional(),
  eventId: z.string().optional(),
  guestName: z.string().min(1),
  partySize: z.number().int().positive(),
  startsAt: z.string().min(1),
  endsAt: z.string().optional(),
  note: z.string().optional(),
  source: z.enum(["manager", "public"]),
  channel: zReservationChannel.optional(),
  guestEmail: z.string().email().optional().or(z.literal("")),
  guestPhone: z.string().optional(),
  promoterId: z.string().optional(),
  guestProfileId: z.string().optional(),
  packageId: z.string().optional(),
  minimumSpendCents: z.number().int().nonnegative().optional(),
  expectedDurationMinutes: z.number().int().positive().optional(),
  depositTermsNote: z.string().optional(),
  cancellationPolicyNote: z.string().optional(),
  seatingNumber: z.union([z.literal(1), z.literal(2)]).optional(),
  bookingLocale: z.enum(["en", "fr"]).optional(),
});

export const zReservationPatch = z.object({
  tableId: z.string().nullable().optional(),
  zoneId: z.string().nullable().optional(),
  eventId: z.string().nullable().optional(),
  guestName: z.string().min(1).optional(),
  partySize: z.number().int().positive().optional(),
  startsAt: z.string().min(1).optional(),
  endsAt: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  channel: zReservationChannel.nullable().optional(),
  guestEmail: z.string().email().nullable().optional().or(z.literal("")),
  guestPhone: z.string().nullable().optional(),
  promoterId: z.string().nullable().optional(),
  guestProfileId: z.string().nullable().optional(),
  packageId: z.string().nullable().optional(),
  minimumSpendCents: z.number().int().nonnegative().nullable().optional(),
  expectedDurationMinutes: z.number().int().positive().nullable().optional(),
  depositTermsNote: z.string().nullable().optional(),
  cancellationPolicyNote: z.string().nullable().optional(),
  seatingNumber: z.union([z.literal(1), z.literal(2)]).nullable().optional(),
});

export const zReservationStatus = z.enum([
  "requested",
  "confirmed",
  "seated",
  "cancelled",
  "completed",
  "no-show",
]);

export const zListReservations = z.object({
  status: z.array(zReservationStatus).optional(),
  zoneIds: z.array(z.string()).optional(),
  date: z.string().optional(),
  promoterId: z.string().optional(),
});

export const zBlackoutDateInput = z.object({
  date: z.string().min(1),
  reason: z.string().min(1),
  zoneId: z.string().optional(),
});

export const zBumpInput = z.object({
  reason: z.string().min(1),
  alternativeTableId: z.string().optional(),
  byStaffId: z.string().min(1),
  byStaffName: z.string().min(1),
});

export const zPublicReservationInput = z.object({
  venueSlug: z.string().min(1).max(50),
  tableId: z.string().min(1).max(30),
  zoneId: z.string().min(1).max(30),
  guestName: z.string().min(1).max(100),
  partySize: z.number().int().positive().max(100),
  date: z.string().min(1).max(10),
  guestEmail: z.string().email().max(254).optional().or(z.literal("")),
  guestPhone: z.string().max(20).optional(),
  note: z.string().max(1000).optional(),
  eventId: z.string().max(30).optional(),
  // Law 25: affirmative consent to the privacy policy before any PII is stored.
  consent: z.literal(true, { message: "You must accept the privacy policy" }),
});

export const zValidatePinInput = z.object({
  pin: z.string().length(6),
});

export const zCapacityCheckInput = z.object({
  date: z.string().min(1),
  partySize: z.number().int().positive(),
});
