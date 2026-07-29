import type { Certification } from "@/lib/types";

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

/**
 * Seeded certifications for the demo venue's staff — one active first-aid,
 * one expiring smart-serve (triggers expiring attention), and one expired
 * security-guard licence. The expiring cert surfaces in the Pulse feed.
 */
export const mockCertifications: Certification[] = [
  {
    id: "cert-1",
    venueId: "venue-1",
    staffId: "st-nina",
    type: "first-aid",
    issuedAt: daysAgo(180),
    expiresAt: daysFromNow(185),
    issuingBody: "Croix-Rouge canadienne",
    referenceNumber: "FA-2026-042",
    verifiedByStaffId: "st-amara",
    verifiedAt: daysAgo(180),
    status: "active",
  },
  {
    id: "cert-2",
    venueId: "venue-1",
    staffId: "st-sofia",
    type: "smart-serve",
    issuedAt: daysAgo(365),
    expiresAt: daysFromNow(14), // expiring in 14 days — triggers cert-expiring attention
    issuingBody: "Smart Serve Ontario (reciprocal QC)",
    verifiedByStaffId: "st-amara",
    verifiedAt: daysAgo(365),
    status: "active",
  },
  {
    id: "cert-3",
    venueId: "venue-1",
    staffId: "st-theo",
    type: "smart-serve",
    issuedAt: daysAgo(20),
    expiresAt: daysFromNow(345),
    issuingBody: "Smart Serve Ontario (reciprocal QC)",
    verifiedByStaffId: "st-amara",
    verifiedAt: daysAgo(20),
    status: "active",
  },
  {
    id: "cert-4",
    venueId: "venue-1",
    staffId: "st-viktor",
    type: "security-guard",
    issuedAt: daysAgo(400),
    expiresAt: daysAgo(35), // expired — triggers cert-expired attention
    issuingBody: "BSP (Bureau de la sécurité privée)",
    referenceNumber: "BSP-2025-1892",
    verifiedByStaffId: "st-amara",
    verifiedAt: daysAgo(400),
    status: "expired",
  },
  {
    id: "cert-5",
    venueId: "venue-1",
    staffId: "st-marcus",
    type: "security-guard",
    issuedAt: daysAgo(120),
    expiresAt: daysFromNow(245),
    issuingBody: "BSP (Bureau de la sécurité privée)",
    referenceNumber: "BSP-2026-0456",
    verifiedByStaffId: "st-amara",
    verifiedAt: daysAgo(120),
    status: "active",
  },
  {
    id: "cert-6",
    venueId: "venue-1",
    staffId: "st-lucas",
    type: "crowd-manager",
    issuedAt: daysAgo(60),
    expiresAt: daysFromNow(305),
    issuingBody: "Régie du bâtiment du Québec",
    verifiedByStaffId: "st-amara",
    verifiedAt: daysAgo(60),
    status: "active",
  },
];
