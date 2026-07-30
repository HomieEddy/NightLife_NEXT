/**
 * Zod schemas for door, occupancy, admissions, coat check & evacuation
 * (plan 17). One schema per route handler input — validates at the boundary
 * (AD-7).
 */
import { z } from "zod";

// ── Occupancy ────────────────────────────────────────────────────────────

export const zAdjustOccupancy = z.object({
  delta: z.number().int(),
  reason: z.string().min(1),
  staffId: z.string().min(1),
});

// ── Admission ────────────────────────────────────────────────────────────

export const zAdmit = z.object({
  guestProfileId: z.string().optional(),
  partySize: z.number().int().positive(),
  admissionType: z.enum(["guestlist", "comp", "cover", "reservation", "member"]),
  amountOwedCents: z.number().int().min(0),
  source: z.enum(["walk-in", "reservation", "guestlist", "re-entry"]),
  reservationId: z.string().optional(),
  eventGuestId: z.string().optional(),
  idCheck: z
    .object({
      checked: z.boolean(),
      dobVerified: z.boolean(),
      yearOfBirth: z.number().int().optional(),
    })
    .optional(),
  staffId: z.string().min(1),
  staffName: z.string().min(1),
  wristbandColor: z.string().optional(),
});

export const zAdmitBannedOverride = z.object({
  guestProfileId: z.string().min(1),
  partySize: z.number().int().positive(),
  reason: z.string().min(1),
  staffId: z.string().min(1),
  staffName: z.string().min(1),
});

export const zAdmitCapacityOverride = z.object({
  guestProfileId: z.string().optional(),
  partySize: z.number().int().positive(),
  reason: z.string().min(1),
  staffId: z.string().min(1),
  staffName: z.string().min(1),
});

export const zAdmitGroup = z.object({
  members: z.array(
    z.object({
      partySize: z.number().int().positive(),
      admissionType: z.enum([
        "guestlist",
        "comp",
        "cover",
        "reservation",
        "member",
      ]),
      amountOwedCents: z.number().int().min(0),
      source: z.enum(["walk-in", "reservation", "guestlist", "re-entry"]),
      guestProfileId: z.string().optional(),
    }),
  ),
  staffId: z.string().min(1),
  staffName: z.string().min(1),
  wristbandColor: z.string().optional(),
});

export const zRecordExit = z.object({
  staffId: z.string().min(1),
});

export const zReEnter = z.object({
  staffId: z.string().min(1),
  staffName: z.string().min(1),
});

// ── Coat check ───────────────────────────────────────────────────────────

export const zCheckInCoat = z.object({
  itemCount: z.number().int().positive(),
  guestProfileId: z.string().optional(),
  staffId: z.string().min(1),
});

// ── Evacuation ───────────────────────────────────────────────────────────

export const zEvacuate = z.object({
  staffId: z.string().min(1),
  staffName: z.string().min(1),
});

export const zResumeEvacuation = z.object({
  staffId: z.string().min(1),
  staffName: z.string().min(1),
});

// ── Refusals ─────────────────────────────────────────────────────────────

export const zRecordRefusal = z.object({
  reason: z.string().min(1),
  description: z.string().min(1),
  partySize: z.number().int().positive(),
  staffId: z.string().min(1),
  staffName: z.string().min(1),
});

// ── Coat check claims ────────────────────────────────────────────────────

export const zReportLostTicket = z.object({
  description: z.string().min(1),
  staffName: z.string().min(1),
});

export const zReportLostItem = z.object({
  ticketId: z.string().min(1),
  description: z.string().min(1),
  staffName: z.string().min(1),
});

export const zResolveClaim = z.object({
  resolution: z.string().min(1),
  staffId: z.string().min(1),
});

// ── Zone occupancy check ─────────────────────────────────────────────────

export const zCheckZoneCapacity = z.object({
  zoneId: z.string().min(1),
  partySize: z.number().int().positive(),
});
