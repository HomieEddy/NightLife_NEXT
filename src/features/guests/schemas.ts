/**
 * Zod schemas for guest profiles, bans, merges, links & referrals
 * (plan 17).
 */
import { z } from "zod";

// ── Profiles ──────────────────────────────────────────────────────────────

export const zCreateProfile = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  dobYear: z.number().int().min(1900).max(2100).optional(),
  tags: z.array(z.string()).optional(),
  vipTier: z.enum(["none", "bronze", "silver", "gold", "platinum"]).optional(),
  notes: z.string().optional(),
  marketingConsent: z
    .object({ email: z.boolean(), sms: z.boolean() })
    .optional(),
  source: z.string().min(1),
  photoUrl: z.string().optional(),
  preferences: z
    .object({
      preferredTable: z.string().optional(),
      preferredDrink: z.string().optional(),
      dietary: z.string().optional(),
      allergies: z.string().optional(),
      celebrationDate: z.string().optional(),
    })
    .optional(),
});

export const zUpdateProfile = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  dobYear: z.number().int().min(1900).max(2100).optional(),
  tags: z.array(z.string()).optional(),
  vipTier: z.enum(["none", "bronze", "silver", "gold", "platinum"]).optional(),
  notes: z.string().optional(),
  photoUrl: z.string().optional(),
  preferences: z
    .object({
      preferredTable: z.string().optional(),
      preferredDrink: z.string().optional(),
      dietary: z.string().optional(),
      allergies: z.string().optional(),
      celebrationDate: z.string().optional(),
    })
    .optional(),
  staffId: z.string().min(1),
  staffName: z.string().min(1),
});

export const zSetBanStatus = z.object({
  banned: z.boolean(),
  reason: z.string().optional(),
  bannedUntil: z.string().optional(),
  staffId: z.string().min(1),
  staffName: z.string().min(1),
});

export const zMergeProfiles = z.object({
  fromId: z.string().min(1),
  toId: z.string().min(1),
  staffId: z.string().min(1),
  staffName: z.string().min(1),
});

export const zFindCandidates = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  dobYear: z.number().int().optional(),
});

// ── GuestLink ─────────────────────────────────────────────────────────────

export const zLinkSessionToProfile = z.object({
  sessionId: z.string().min(1),
  guestProfileId: z.string().min(1),
});

// ── Referrals ─────────────────────────────────────────────────────────────

export const zCreateReferral = z.object({
  referrerProfileId: z.string().min(1),
  referredProfileId: z.string().min(1),
  source: z.string().min(1),
});

// ── Deletion ──────────────────────────────────────────────────────────────

export const zDeleteProfileData = z.object({
  staffId: z.string().min(1),
  staffName: z.string().min(1),
});

// ── Record visit ──────────────────────────────────────────────────────────

export const zRecordVisit = z.object({
  netCents: z.number().int(),
});
