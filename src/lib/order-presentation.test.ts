import { expect, it } from "vitest";
import { orderNeedsShow } from "./order-presentation";
import type { Order } from "./types";

it("detects presentation by structured kind regardless of labels", () => {
  const order = {
    items: [{ modifiers: [{ kind: "presentation", groupName: "Mise en scène" }] }],
  } as Order;
  expect(orderNeedsShow(order)).toBe(true);
});

it("does not treat a washer named Presentation as a show", () => {
  const order = {
    items: [{ modifiers: [{ kind: "washer", groupName: "Presentation" }] }],
  } as Order;
  expect(orderNeedsShow(order)).toBe(false);
});
