import { describe, expect, it } from "vitest";
import {
  businessDateFor,
  canApplyOccupancyDelta,
  canMarkNoShow,
  computeOccupancy,
  countDeliveredAlcoholicDrinks,
  dedupeCandidates,
  isBanned,
  occupancyRatio,
  waitlistPosition,
} from "./door";
import type { GuestProfile, MenuItem, OccupancyEvent, Order, WaitlistEntry } from "@/lib/types";

function profile(overrides: Partial<GuestProfile>): GuestProfile {
  return {
    id: "gp-x",
    venueId: "venue-1",
    displayName: "Test Guest",
    firstName: "Test",
    tags: [],
    vipTier: "none",
    status: "active",
    marketingConsent: { email: false, sms: false, capturedAt: "2026-01-01T00:00:00.000Z", source: "door" },
    createdAt: "2026-01-01T00:00:00.000Z",
    visitCount: 0,
    lifetimeNetCents: 0,
    ...overrides,
  };
}

describe("occupancy (INV-D1)", () => {
  it("sums deltas for the business date only", () => {
    const events: OccupancyEvent[] = [
      { id: "1", venueId: "v", businessDate: "2026-07-25", delta: 4, reason: "walk-in", staffId: "s1", at: "" },
      { id: "2", venueId: "v", businessDate: "2026-07-25", delta: -1, reason: "exit", staffId: "s1", at: "" },
      { id: "3", venueId: "v", businessDate: "2026-07-24", delta: 100, reason: "walk-in", staffId: "s1", at: "" },
    ];
    expect(computeOccupancy(events, "2026-07-25")).toBe(3);
  });

  it("never allows a delta that would push occupancy negative", () => {
    expect(canApplyOccupancyDelta(0, -1)).toBe(false);
    expect(canApplyOccupancyDelta(1, -1)).toBe(true);
    expect(canApplyOccupancyDelta(0, -4)).toBe(false);
  });

  it("re-entry (net-zero delta) never changes occupancy", () => {
    // A re-entry only adjusts occupancy by the party size delta already
    // reflected once at original admission — the caller must not emit a
    // second +partySize event, which this guard alone can't prevent, but
    // the net effect of "admit, exit, re-enter" is idempotent on the ledger.
    const events: OccupancyEvent[] = [
      { id: "1", venueId: "v", businessDate: "2026-07-25", delta: 4, reason: "walk-in", staffId: "s1", at: "" },
      { id: "2", venueId: "v", businessDate: "2026-07-25", delta: -4, reason: "exit", staffId: "s1", at: "" },
      { id: "3", venueId: "v", businessDate: "2026-07-25", delta: 4, reason: "re-entry", staffId: "s1", at: "" },
    ];
    expect(computeOccupancy(events, "2026-07-25")).toBe(4);
  });

  it("computes a warn ratio against legal capacity", () => {
    expect(occupancyRatio(360, 400)).toBeCloseTo(0.9);
    expect(occupancyRatio(10, 0)).toBe(0);
  });
});

describe("waitlist position", () => {
  it("is stable under insert and leave", () => {
    const entries: WaitlistEntry[] = [
      { id: "w1", venueId: "v", name: "A", partySize: 2, quotedMinutes: 20, status: "waiting", joinedAt: "2026-07-25T22:00:00.000Z" },
      { id: "w2", venueId: "v", name: "B", partySize: 4, quotedMinutes: 25, status: "waiting", joinedAt: "2026-07-25T22:05:00.000Z" },
      { id: "w3", venueId: "v", name: "C", partySize: 2, quotedMinutes: 30, status: "waiting", joinedAt: "2026-07-25T22:10:00.000Z" },
    ];
    expect(waitlistPosition(entries, "w1")).toBe(1);
    expect(waitlistPosition(entries, "w2")).toBe(2);
    expect(waitlistPosition(entries, "w3")).toBe(3);

    // w1 leaves — w2 and w3 shift up, but positions are recomputed, not stored.
    const afterLeave = entries.map((e) => (e.id === "w1" ? { ...e, status: "left" as const } : e));
    expect(waitlistPosition(afterLeave, "w2")).toBe(1);
    expect(waitlistPosition(afterLeave, "w3")).toBe(2);

    // A new insert between w2 and w3's join times slots in correctly.
    const withInsert: WaitlistEntry[] = [
      ...afterLeave,
      { id: "w4", venueId: "v", name: "D", partySize: 3, quotedMinutes: 15, status: "waiting", joinedAt: "2026-07-25T22:07:00.000Z" },
    ];
    expect(waitlistPosition(withInsert, "w2")).toBe(1);
    expect(waitlistPosition(withInsert, "w4")).toBe(2);
    expect(waitlistPosition(withInsert, "w3")).toBe(3);
  });

  it("returns null for an entry not in the list", () => {
    expect(waitlistPosition([], "missing")).toBeNull();
  });
});

describe("guest dedupe", () => {
  const profiles: GuestProfile[] = [
    profile({ id: "gp-phone", firstName: "Marc", lastName: "Bélanger", phone: "+15145550199" }),
    profile({ id: "gp-email", firstName: "Sophie", lastName: "Martin", email: "sophie@example.com" }),
    profile({ id: "gp-name", firstName: "Camille", lastName: "Laurent", dobYear: 1994 }),
  ];

  it("matches phone before name, even when name also matches a different profile", () => {
    const matches = dedupeCandidates(
      { phone: "+15145550199", firstName: "Someone", lastName: "Else" },
      profiles,
    );
    expect(matches.map((m) => m.id)).toEqual(["gp-phone"]);
  });

  it("falls back to email when phone doesn't match", () => {
    const matches = dedupeCandidates({ email: "SOPHIE@example.com", firstName: "X" }, profiles);
    expect(matches.map((m) => m.id)).toEqual(["gp-email"]);
  });

  it("falls back to name+dobYear when no phone/email given", () => {
    const matches = dedupeCandidates({ firstName: "Camille", lastName: "Laurent", dobYear: 1994 }, profiles);
    expect(matches.map((m) => m.id)).toEqual(["gp-name"]);
  });

  it("excludes a name match when dobYear disagrees", () => {
    const matches = dedupeCandidates({ firstName: "Camille", lastName: "Laurent", dobYear: 1980 }, profiles);
    expect(matches).toHaveLength(0);
  });
});

describe("ban check", () => {
  it("is banned with no expiry", () => {
    expect(isBanned(profile({ status: "banned" }))).toBe(true);
  });

  it("is not banned once bannedUntil has passed", () => {
    const now = new Date("2026-07-26T00:00:00.000Z");
    expect(isBanned(profile({ status: "banned", bannedUntil: "2026-07-01T00:00:00.000Z" }), now)).toBe(false);
    expect(isBanned(profile({ status: "banned", bannedUntil: "2026-08-01T00:00:00.000Z" }), now)).toBe(true);
  });

  it("active profiles and null are never banned", () => {
    expect(isBanned(profile({ status: "active" }))).toBe(false);
    expect(isBanned(null)).toBe(false);
  });
});

describe("no-show gating", () => {
  it("is only reachable from confirmed", () => {
    expect(canMarkNoShow("confirmed")).toBe(true);
    expect(canMarkNoShow("requested")).toBe(false);
    expect(canMarkNoShow("seated")).toBe(false);
    expect(canMarkNoShow("cancelled")).toBe(false);
    expect(canMarkNoShow("completed")).toBe(false);
    expect(canMarkNoShow("no-show")).toBe(false);
  });
});

describe("responsible-service drink counter", () => {
  const menuItems: MenuItem[] = [
    { id: "m-vodka", categoryId: "c1", name: "Vodka soda", description: "", price: 12, icon: "vodka", tags: [], isAvailable: true, inventory: 10, isAlcoholic: true, allergens: [] },
    { id: "m-water", categoryId: "c1", name: "Sparkling water", description: "", price: 5, icon: "package", tags: [], isAvailable: true, inventory: 10, isAlcoholic: false, allergens: [] },
  ];

  function order(overrides: Partial<Order>): Order {
    return {
      id: "o1", code: "A-001", venueId: "v", tableId: "t1", tableCode: "T1", zoneId: "z1", zoneName: "Z",
      guestName: "G", items: [], subtotal: 0, serviceFee: 0, tip: 0, total: 0, status: "delivered",
      placedAt: "", updatedAt: "", sessionId: "s1",
      ...overrides,
    };
  }

  it("counts only delivered alcoholic items", () => {
    const orders: Order[] = [
      order({
        status: "delivered",
        items: [
          { id: "i1", menuItemId: "m-vodka", name: "Vodka soda", quantity: 2, unitPrice: 12, modifiers: [] },
          { id: "i2", menuItemId: "m-water", name: "Sparkling water", quantity: 3, unitPrice: 5, modifiers: [] },
        ],
      }),
      order({
        id: "o2",
        status: "pending", // not delivered yet — must not count
        items: [{ id: "i3", menuItemId: "m-vodka", name: "Vodka soda", quantity: 5, unitPrice: 12, modifiers: [] }],
      }),
    ];
    expect(countDeliveredAlcoholicDrinks(orders, menuItems, "s1")).toBe(2);
  });

  it("ignores orders from a different session", () => {
    const orders: Order[] = [
      order({ sessionId: "other", items: [{ id: "i1", menuItemId: "m-vodka", name: "V", quantity: 4, unitPrice: 12, modifiers: [] }] }),
    ];
    expect(countDeliveredAlcoholicDrinks(orders, menuItems, "s1")).toBe(0);
  });
});

describe("business-date rollover (shared with tab ledger)", () => {
  it("buckets a post-midnight close to the night it started", () => {
    // Venue nightEndHour 10 — a 03:00 close on Saturday still belongs to Friday's night.
    expect(businessDateFor("2026-07-25T03:00:00", 10)).toBe("2026-07-24");
    expect(businessDateFor("2026-07-25T11:00:00", 10)).toBe("2026-07-25");
  });
});
