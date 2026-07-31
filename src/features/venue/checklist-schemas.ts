import { z } from "zod";

export const zChecklistTemplateItem = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  required: z.boolean(),
});

export const zCreateTemplate = z.object({
  name: z.string().min(1),
  type: z.enum(["opening", "closing"]),
  active: z.boolean().optional(),
  items: z.array(zChecklistTemplateItem),
});

export const zUpdateTemplate = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["opening", "closing"]).optional(),
  active: z.boolean().optional(),
  items: z.array(zChecklistTemplateItem).optional(),
});

export const zStartRun = z.object({
  templateId: z.string().min(1),
  businessDate: z.string().min(1),
  staffId: z.string().min(1),
  staffName: z.string().min(1),
});

export const zCheckItem = z.object({
  templateItemId: z.string().min(1),
  checked: z.boolean(),
  staffId: z.string().min(1),
  note: z.string().optional(),
});

export const zCompleteRun = z.object({
  staffId: z.string().min(1),
  staffName: z.string().min(1),
});
