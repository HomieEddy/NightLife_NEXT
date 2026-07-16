import { describe, expect, it } from "vitest";
import { zVenuePatch } from "./venue";

describe("venue time settings", () => {
  it("rejects invalid IANA timezones", () => {
    expect(zVenuePatch.safeParse({ timezone: "Not/AZone" }).success).toBe(false);
  });

  it("rejects duplicate opening days and malformed times", () => {
    expect(zVenuePatch.safeParse({
      openingHours: [
        { day: "Friday", open: "22:00", close: "03:00" },
        { day: "Friday", open: "later", close: "03:00" },
      ],
    }).success).toBe(false);
  });

  it("rejects equal night boundaries", () => {
    expect(zVenuePatch.safeParse({ nightStartHour: 10, nightEndHour: 10 }).success).toBe(false);
  });
});
