import { describe, it, expect } from "vitest";
import { zSendGift } from "./schemas";

const base = {
  fromTableId: "t1",
  fromTableCode: "VIP-01",
  fromZoneId: "z1",
  fromZoneName: "VIP",
  guestName: "Henry",
  toTableId: "t2",
  toTableCode: "VIP-02",
};

describe("zSendGift", () => {
  it("accepts the items[] shape both tracks send", () => {
    const parsed = zSendGift.safeParse({
      ...base,
      items: [{ menuItemId: "mi-1", quantity: 2 }],
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts multiple gift items", () => {
    const parsed = zSendGift.safeParse({
      ...base,
      items: [
        { menuItemId: "mi-1", quantity: 1 },
        { menuItemId: "mi-2", quantity: 3 },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a gift with no items", () => {
    const parsed = zSendGift.safeParse({ ...base, items: [] });
    expect(parsed.success).toBe(false);
  });

  it("rejects the old single menuItemId shape (the live 400)", () => {
    const parsed = zSendGift.safeParse({ ...base, menuItemId: "mi-1" });
    expect(parsed.success).toBe(false);
  });
});
