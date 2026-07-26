import type { AuthUser } from "@/lib/types";

/** Demo identities the shared /login screen can sign in as. No real auth yet. */
export const mockPersonas: AuthUser[] = [
  {
    id: "st-amara",
    name: "Amara Bélanger",
    email: "amara@velvetmtl.club",
    role: "manager",
    venueId: "venue-1",
  },
  {
    id: "st-lucas",
    name: "Lucas Gagné",
    email: "lucas@velvetmtl.club",
    role: "staff",
    staffRole: "host",
    venueId: "venue-1",
  },
  {
    id: "st-sofia",
    name: "Sofia Lévesque",
    email: "sofia@velvetmtl.club",
    role: "staff",
    staffRole: "bartender",
    venueId: "venue-1",
  },
  {
    id: "st-nina",
    name: "Nina Côté",
    email: "nina@velvetmtl.club",
    role: "staff",
    staffRole: "runner",
    venueId: "venue-1",
  },
  {
    id: "st-viktor",
    name: "Viktor Michaud",
    email: "viktor@velvetmtl.club",
    role: "staff",
    staffRole: "security",
    venueId: "venue-1",
  },
  {
    id: "st-julien",
    name: "Julien Dubois",
    email: "julien@velvetmtl.club",
    role: "staff",
    staffRole: "promoter",
    venueId: "venue-1",
  },
];
