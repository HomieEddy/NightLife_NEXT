import type { ServiceFee, Venue } from "@/lib/types";

/** One display line: the configured fee plus its dollars amount. */
export interface FeeLine {
  fee: ServiceFee;
  amount: number;
}

/** Short human label for one fee, e.g. "5%" or "$10 flat". */
export function feeLabel(fee: ServiceFee): string {
  return fee.type === "flat" ? `$${fee.value} flat` : `${fee.value}%`;
}

/** RV-03: Returns the auto-gratuity rate that should apply for this party size and zone, or null if none triggers. */
export function getAutoGratuityRate(
  venue: Venue,
  partySize: number,
  tableMinimumCents?: number | null,
): number | null {
  if (!venue.autoGratuityRules || venue.autoGratuityRules.length === 0) return null;
  const rule = venue.autoGratuityRules
    .filter((r) => partySize >= r.minPartySize)
    .sort((a, b) => b.minPartySize - a.minPartySize)[0];
  if (!rule) return null;
  if (tableMinimumCents && tableMinimumCents > 50000) return rule.ratePct + 2;
  return rule.ratePct;
}
