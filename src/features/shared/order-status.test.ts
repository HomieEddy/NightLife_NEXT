import { describe, it, expect } from "vitest";
import { ORDER_FLOW, nextStatus } from "./order-status";
import type { OrderStatus } from "@/lib/types";

describe("nextStatus (order state machine)", () => {
  it("moves a pending order to accepted", () => {
    expect(nextStatus("pending")).toBe("accepted");
  });

  it("advances each step of the flow in order", () => {
    expect(nextStatus("accepted")).toBe("preparing");
    expect(nextStatus("preparing")).toBe("ready");
    expect(nextStatus("ready")).toBe("delivered");
  });

  it("returns null for the terminal delivered state — cannot advance", () => {
    expect(nextStatus("delivered")).toBeNull();
  });

  it("returns null for cancelled — a cancelled order is never advanced", () => {
    expect(nextStatus("cancelled")).toBeNull();
  });
});

describe("ORDER_FLOW", () => {
  it("is exactly the forward progression, pending → delivered", () => {
    expect(ORDER_FLOW).toEqual(["pending", "accepted", "preparing", "ready", "delivered"]);
  });

  it("contains only valid OrderStatus values", () => {
    const statuses: OrderStatus[] = [
      "pending", "accepted", "preparing", "ready", "delivered", "cancelled",
    ];
    for (const step of ORDER_FLOW) {
      expect(statuses).toContain(step);
    }
  });
});
