import { z } from "zod";
import { ASSIGNABLE_ROLES } from "@/lib/types";

const zStaffRole = z.enum(ASSIGNABLE_ROLES);

export const zStaffInvite = z.object({
  name: z.string().trim().min(1),
  email: z.email(),
  phone: z.string(),
  role: zStaffRole,
  assignedZoneIds: z.array(z.string()),
});

export const zStaffPatch = z.object({
  name: z.string().trim().min(1).optional(),
  phone: z.string().optional(),
  role: zStaffRole.optional(),
  assignedZoneIds: z.array(z.string()).optional(),
  accountStatus: z.enum(["active", "suspended"]).optional(),
});
