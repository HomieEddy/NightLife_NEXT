import type { Order } from "@/lib/types";

/**
 * Rough "time until delivered" for an in-flight order, based on the venue's
 * average fulfillment time tonight. Returns null once the order is settled.
 */
export function estimateEtaMinutes(order: Order, avgFulfillmentMinutes: number): number | null {
  if (order.status === "delivered" || order.status === "cancelled") return null;
  if (order.status === "ready") return 1; // already walking out
  const elapsedMinutes = (Date.now() - new Date(order.placedAt).getTime()) / 60_000;
  return Math.max(1, Math.round(avgFulfillmentMinutes - elapsedMinutes));
}

/** "Arriving any moment" below ~2 min, otherwise "~N min". */
export function formatEta(minutes: number | null): string | null {
  if (minutes === null) return null;
  return minutes <= 2 ? "Arriving any moment" : `~${minutes} min`;
}
