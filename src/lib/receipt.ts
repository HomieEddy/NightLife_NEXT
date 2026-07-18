import type { Order } from "@/lib/types";

/** Distributes `total` across `count` shares in whole cents, so they always sum exactly. */
export function evenShares(total: number, count: number): number[] {
  const totalCents = Math.round(total * 100);
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, i) => (base + (i < remainder ? 1 : 0)) / 100);
}

export interface ReceiptFeeLine {
  name: string;
  type: "percentage" | "flat";
  value: number;
  amount: number;
}

export interface ReceiptSummary {
  subtotal: number;
  tip: number;
  total: number;
  promoCents: number;
  feeLines: ReceiptFeeLine[];
}

/** Rolls a night's delivered orders into one receipt: totals plus fees merged by fee id. */
export function summarizeReceipt(orders: Order[]): ReceiptSummary {
  const feeMap = new Map<string, ReceiptFeeLine>();
  for (const order of orders) {
    for (const line of order.feeBreakdown ?? []) {
      const existing = feeMap.get(line.fee.id);
      if (existing) {
        existing.amount += line.amount;
      } else {
        feeMap.set(line.fee.id, {
          name: line.fee.name,
          type: line.fee.type,
          value: line.fee.value,
          amount: line.amount,
        });
      }
    }
  }
  return {
    subtotal: orders.reduce((s, o) => s + o.subtotal, 0),
    tip: orders.reduce((s, o) => s + o.tip, 0),
    total: orders.reduce((s, o) => s + o.total, 0),
    promoCents: orders.reduce((s, o) => s + (o.promotionCents ?? 0), 0),
    feeLines: Array.from(feeMap.values()),
  };
}
