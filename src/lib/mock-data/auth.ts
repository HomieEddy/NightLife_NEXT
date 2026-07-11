import type { AuthUser } from "@/lib/types";

/** Demo identities the shared /login screen can sign in as. No real auth yet. */
export const mockPersonas: AuthUser[] = [
  {
    id: "st-amara",
    name: "Amara Diallo",
    email: "amara@velvetmtl.club",
    role: "manager",
    venueId: "venue-1",
  },
  {
    id: "st-nina",
    name: "Nina Kovač",
    email: "nina@velvetmtl.club",
    role: "staff",
    venueId: "venue-1",
  },
  {
    id: "admin-1",
    name: "Platform Admin",
    email: "admin@nightlifext.com",
    role: "admin",
  },
];
