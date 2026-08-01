import { z } from "zod";

export const zPromotionInput = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["percentage", "flat"]),
  value: z.number().positive(),
  appliesToCategoryIds: z.array(z.string()).default([]),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
});

export const zPromotionPatch = zPromotionInput.partial();
