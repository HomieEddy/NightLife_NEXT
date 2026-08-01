import { z } from "zod";

export const zEventInput = z.object({
  name: z.string().min(1),
  description: z.string(),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  zoneId: z.string().optional(),
  capacity: z.number().int().positive(),
  status: z.enum(["draft", "published", "live", "ended", "cancelled"]),
  guestlistEnabled: z.boolean(),
  ticketUrl: z.string().url().optional().or(z.literal("")),
});

export const zEventPatch = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  startsAt: z.string().min(1).optional(),
  endsAt: z.string().min(1).optional(),
  zoneId: z.string().nullable().optional(),
  capacity: z.number().int().positive().optional(),
  status: z.enum(["draft", "published", "live", "ended", "cancelled"]).optional(),
  guestlistEnabled: z.boolean().optional(),
  ticketUrl: z.string().url().nullable().optional().or(z.literal("")),
});

export const zEventGuestInput = z.object({
  eventId: z.string().min(1),
  name: z.string().min(1),
  partySize: z.number().int().positive(),
  guestProfileId: z.string().optional(),
  promoterId: z.string().optional(),
});

export const zEventGuestStatus = z.enum(["invited", "confirmed", "checked-in"]);

export const zCancelEvent = z.object({
  reason: z.string().min(1),
});

export const zTalentInput = z.object({
  eventId: z.string().min(1),
  name: z.string().min(1),
  role: z.enum(["dj", "mc", "performer", "host", "dancer", "musician", "other"]),
  setTimes: z.array(z.object({
    start: z.string(),
    end: z.string(),
  })).optional().default([]),
  arrivalTime: z.string().optional(),
  rider: z.string().optional(),
  greenRoom: z.string().optional(),
  status: z.enum(["scheduled", "arrived", "performing", "completed", "cancelled"]).optional().default("scheduled"),
});

export const zTalentPatch = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["dj", "mc", "performer", "host", "dancer", "musician", "other"]).optional(),
  setTimes: z.array(z.object({
    start: z.string(),
    end: z.string(),
  })).optional(),
  arrivalTime: z.string().nullable().optional(),
  rider: z.string().nullable().optional(),
  greenRoom: z.string().nullable().optional(),
  status: z.enum(["scheduled", "arrived", "performing", "completed", "cancelled"]).optional(),
});
