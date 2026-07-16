import { describe, expect, it } from "vitest";
import { orderLineSubtotal } from "./order-line";

describe("order line subtotal", () => {
  it("does not multiply add-on quantity by line quantity", () => {
    expect(
      orderLineSubtotal(200, 2, [
        { priceDelta: 6, quantity: 3 },
      ]),
    ).toBe(418);
  });

  it("supports multiple washer and presentation choices", () => {
    expect(
      orderLineSubtotal(200, 2, [
        { priceDelta: 6, quantity: 3 },
        { priceDelta: 25, quantity: 1 },
      ]),
    ).toBe(443);
  });
});
