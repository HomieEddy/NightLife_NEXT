/**
 * Guest domain seed data. Demo: imported by mock-service.ts.
 * Live: imported by prisma/seed-staging.ts.
 */

import type { VipTierBenefit } from "@/lib/types";

export const MOCK_VIP_TIER_BENEFITS: VipTierBenefit[] = [
  { id: "vtb-1", venueId: "venue-1", tier: "vip", benefit: "Priority bottle-service presentation", category: "bottle-service", sortOrder: 1, active: true },
  { id: "vtb-2", venueId: "venue-1", tier: "vip", benefit: "Dedicated VIP host for the night", category: "service", sortOrder: 2, active: true },
  { id: "vtb-3", venueId: "venue-1", tier: "vip", benefit: "Guaranteed VIP-section table", category: "reservation", sortOrder: 3, active: true },
  { id: "vtb-4", venueId: "venue-1", tier: "vip", benefit: "Skip-the-line entry for you and your party", category: "admission", sortOrder: 4, active: true },
  { id: "vtb-5", venueId: "venue-1", tier: "host-list", benefit: "Priority reservation access", category: "reservation", sortOrder: 1, active: true },
  { id: "vtb-6", venueId: "venue-1", tier: "host-list", benefit: "Expedited check-in at the door", category: "admission", sortOrder: 2, active: true },
  { id: "vtb-7", venueId: "venue-1", tier: "regular", benefit: "Birthday celebration acknowledgment", category: "service", sortOrder: 1, active: true },
  { id: "vtb-8", venueId: "venue-1", tier: "regular", benefit: "Standard bottle presentation", category: "bottle-service", sortOrder: 2, active: true },
];
