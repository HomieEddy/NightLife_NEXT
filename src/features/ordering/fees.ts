import type { ServiceFee, Venue } from "@/lib/types";

export interface FeeLine {
  fee: ServiceFee;
  amount: number;
}

/** One line per configured fee, each rounded to the cent. Flat fees only apply to non-empty orders. */
export function computeFeeLines(subtotal: number, venue: Venue): FeeLine[] {
  if (subtotal <= 0) return [];
  return venue.serviceFees.map((fee) => ({
    fee,
    amount:
      fee.type === "flat" ? fee.value : Math.round(subtotal * fee.value) / 100,
  }));
}

/** Total of all configured fees for an order subtotal. */
export function computeServiceFee(subtotal: number, venue: Venue): number {
  return (
    Math.round(computeFeeLines(subtotal, venue).reduce((sum, l) => sum + l.amount, 0) * 100) / 100
  );
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
