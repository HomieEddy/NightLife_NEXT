import type { Order } from "./types";

export function orderNeedsShow(order: Order): boolean {
  return order.items.some((item) => item.modifiers.some((modifier) => modifier.kind === "presentation"));
}

export function showLabelFor(order: Order): string {
  const labels = order.items.flatMap((item) =>
    item.modifiers
      .filter((modifier) => modifier.kind === "presentation")
      .map((modifier) => `${modifier.quantity}× ${modifier.optionName}`),
  );
  return labels.length > 0 ? labels.join(" + ") : "Presentation";
}
