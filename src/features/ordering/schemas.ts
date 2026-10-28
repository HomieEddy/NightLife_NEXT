import { z } from "zod";

const zOrderLineModifier = z.object({
  groupId: z.string().min(1),
  optionId: z.string().min(1),
  quantity: z.number().int().positive(),
});

const zOrderLine = z.object({
  menuItemId: z.string().min(1),
  quantity: z.number().int().positive(),
  modifiers: z.array(zOrderLineModifier).optional().default([]),
  note: z.string().optional(),
});

export const zSubmitOrder = z.object({
  tableId: z.string().min(1),
  tableCode: z.string().min(1),
  zoneId: z.string().min(1),
  zoneName: z.string().min(1),
  guestName: z.string().min(1),
  sessionId: z.string().optional(),
  lines: z.array(zOrderLine).min(1),
  tipCents: z.number().int().nonnegative(),
  promoCode: z.string().optional(),
});

export const zSendGift = z.object({
  fromTableId: z.string().min(1),
  fromTableCode: z.string().min(1),
  fromZoneId: z.string().min(1),
  fromZoneName: z.string().min(1),
  guestName: z.string().min(1),
  sessionId: z.string().optional(),
  items: z.array(z.object({
    menuItemId: z.string().min(1),
    quantity: z.number().int().positive(),
  })).min(1),
  toTableId: z.string().min(1),
  toTableCode: z.string().min(1),
  note: z.string().optional(),
});

export const zClaimOrder = z.object({
  staffId: z.string().min(1),
  staffName: z.string().min(1),
});

export const zListOrders = z.object({
  status: z.array(z.enum(["pending", "accepted", "preparing", "ready", "delivered", "cancelled"])).optional(),
  zoneIds: z.array(z.string()).optional(),
  sessionId: z.string().optional(),
  guestName: z.string().optional(),
  /** Newest-first, capped — a venue's order history grows forever. */
  limit: z.number().int().min(1).max(200).optional(),
});
