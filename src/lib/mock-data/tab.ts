import type { AdjustmentReason } from "@/lib/types";

/** Seeded per plan 16's design — editable in /manager/settings. */
export const mockAdjustmentReasons: AdjustmentReason[] = [
  { id: "ar-void-1", venueId: "venue-1", kind: "void", code: "wrong-item", label: "Wrong item rung in", isActive: true },
  { id: "ar-void-2", venueId: "venue-1", kind: "void", code: "mis-rung", label: "Mis-rung / duplicate", isActive: true },
  { id: "ar-void-3", venueId: "venue-1", kind: "void", code: "guest-changed-mind", label: "Guest changed mind before delivery", isActive: true },
  { id: "ar-comp-1", venueId: "venue-1", kind: "comp", code: "service-recovery", label: "Service recovery", isActive: true },
  { id: "ar-comp-2", venueId: "venue-1", kind: "comp", code: "house-hospitality", label: "House hospitality", isActive: true },
  { id: "ar-comp-3", venueId: "venue-1", kind: "comp", code: "vip", label: "VIP treatment", isActive: true },
  { id: "ar-comp-4", venueId: "venue-1", kind: "comp", code: "staff-error", label: "Staff error", isActive: true },
  { id: "ar-discount-1", venueId: "venue-1", kind: "discount", code: "negotiated-table", label: "Negotiated table deal", isActive: true },
  { id: "ar-discount-2", venueId: "venue-1", kind: "discount", code: "manager-goodwill", label: "Manager goodwill", isActive: true },
  { id: "ar-discount-3", venueId: "venue-1", kind: "discount", code: "event-deal", label: "Event/promo deal", isActive: true },
];
