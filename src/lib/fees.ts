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
