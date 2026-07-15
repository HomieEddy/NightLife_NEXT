import type { OrderStatus } from "@/lib/types";

export const ORDER_FLOW = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "delivered",
] as const satisfies readonly OrderStatus[];

export function nextStatus(status: OrderStatus): OrderStatus | null {
  const index = (ORDER_FLOW as readonly OrderStatus[]).indexOf(status);
  return index >= 0 && index < ORDER_FLOW.length - 1 ? ORDER_FLOW[index + 1] : null;
}
