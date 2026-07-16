import { z } from "zod";

// JSONB columns are Zod-validated on write, not trusted on read (§4).

export const zServiceFee = z.object({
  id: z.string().min(1),
  name: z.string(),
  type: z.enum(["percentage", "flat"]),
  value: z.number(),
});

export const zOpeningHour = z.object({
  day: z.string().min(1),
  open: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  close: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

const zOpeningHours = z.array(zOpeningHour).superRefine((slots, context) => {
  const seen = new Set<string>();
  for (const [index, slot] of slots.entries()) {
    if (seen.has(slot.day)) {
      context.addIssue({ code: "custom", path: [index, "day"], message: "Opening days must be unique" });
    }
    seen.add(slot.day);
  }
});

const zTimezone = z.string().min(1).refine((timezone) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}, "Invalid IANA timezone");

export const zFloorMap = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
});

export const zSlaThresholds = z.object({
  orderWarnMinutes: z.number().int().positive(),
  orderCriticalMinutes: z.number().int().positive(),
  helpWarnMinutes: z.number().int().positive(),
  helpCriticalMinutes: z.number().int().positive(),
});

export const zVenuePatch = z.object({
  name: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  timezone: zTimezone.optional(),
  currency: z.enum(["CAD", "EUR", "USD", "GBP"]).optional(),
  openingHours: zOpeningHours.optional(),
  serviceFees: z.array(zServiceFee).optional(),
  floorMap: zFloorMap.optional(),
  autoApproveGuests: z.boolean().optional(),
  logoInitials: z.string().min(1).optional(),
  slaThresholds: zSlaThresholds.optional(),
  lastCallAutoFlagTables: z.boolean().optional(),
  nightStartHour: z.number().int().min(0).max(23).optional(),
  nightEndHour: z.number().int().min(0).max(23).optional(),
}).superRefine((value, context) => {
  if (value.nightStartHour !== undefined && value.nightStartHour === value.nightEndHour) {
    context.addIssue({ code: "custom", path: ["nightEndHour"], message: "Night boundaries must differ" });
  }
});

export const zZoneColor = z.enum(["violet", "fuchsia", "cyan", "amber", "emerald", "rose"]);

export const zZoneInput = z.object({
  name: z.string().min(1),
  description: z.string(),
  color: zZoneColor,
});

export const zZonePatch = zZoneInput.partial();

export const zTableStatus = z.enum(["open", "occupied", "reserved", "closed"]);

export const zTableInput = z.object({
  zoneId: z.string().min(1),
  code: z.string().min(1),
  label: z.string().min(1),
  seats: z.number().int().positive(),
  minimumSpend: z.number().nonnegative().nullable(),
  status: zTableStatus,
  mapX: z.number().min(0).max(100).optional(),
  mapY: z.number().min(0).max(100).optional(),
});

export const zTablePatch = zTableInput.partial();

export const zTablePosition = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
});
