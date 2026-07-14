import { describe, it, expect } from "vitest";
import { derivePromotionStatus } from "./promotions-core";

describe("derivePromotionStatus", () => {
  const d = (iso: string) => new Date(iso);

  it("returns 'scheduled' when now is before startsAt", () => {
    expect(
      derivePromotionStatus(d("2026-08-01T00:00:00Z"), d("2026-08-31T23:59:59Z"), d("2026-07-15T12:00:00Z")),
    ).toBe("scheduled");
  });

  it("returns 'active' when now is between startsAt and endsAt", () => {
    expect(
      derivePromotionStatus(d("2026-07-01T00:00:00Z"), d("2026-07-31T23:59:59Z"), d("2026-07-15T12:00:00Z")),
    ).toBe("active");
  });

  it("returns 'expired' when now is after endsAt", () => {
    expect(
      derivePromotionStatus(d("2026-06-01T00:00:00Z"), d("2026-06-30T23:59:59Z"), d("2026-07-15T12:00:00Z")),
    ).toBe("expired");
  });

  it("returns 'active' at exact startsAt boundary", () => {
    const t = d("2026-07-10T22:00:00Z");
    expect(derivePromotionStatus(t, d("2026-07-11T04:00:00Z"), t)).toBe("active");
  });

  it("returns 'expired' at exact endsAt boundary (now > endsAt by 1ms)", () => {
    const end = d("2026-07-10T04:00:00Z");
    const justAfter = new Date(end.getTime() + 1);
    expect(derivePromotionStatus(d("2026-07-09T22:00:00Z"), end, justAfter)).toBe("expired");
  });

  it("returns 'active' exactly at endsAt (not expired)", () => {
    const t = d("2026-07-10T04:00:00Z");
    expect(derivePromotionStatus(d("2026-07-09T22:00:00Z"), t, t)).toBe("active");
  });
});
