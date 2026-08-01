import { z } from "zod";

/**
 * Validates the shape of a RolePermissions payload.
 * Accepts any string[] per role — individual action validity is
 * handled by canDo() at authorization time, not at the API boundary.
 */
export const zRolePermissions = z.object({
  manager: z.array(z.string()),
  host: z.array(z.string()),
  bartender: z.array(z.string()),
  runner: z.array(z.string()),
  security: z.array(z.string()),
  promoter: z.array(z.string()),
});
