import { describe, it, expect } from "vitest";
import {
  reseedRng, rand, randInt, pick, pickDistinct, stableHash, seededPin,
  daysAgo, isoDate, businessDateFor, isOpenNight,
  nightVolumeMultiplier, outlierMultiplier,
  computeFeeBreakdown, totalFeeCents,
  generateFullCorpus, generateNightActivity, generatePresentTense,
  generateGuestProfiles, generateHistoricalEvents, generateHistoricalReservations,
  generateHistoricalPromotions,
  CORPUS_VENUE, CORPUS_ZONES, CORPUS_TABLES, CORPUS_ROSTER,
  CORPUS_MENU_ITEMS, CORPUS_OUTLIERS,
} from "./seed-corpus";

// ── PRNG ──────────────────────────────────────────────────────────────

describe("seeded PRNG", () => {
  it("produces the same sequence when re-seeded identically", () => {
    reseedRng(42);
    const a = [rand(), rand(), rand(), randInt(0, 100), randInt(0, 100)];

    reseedRng(42);
    const b = [rand(), rand(), rand(), randInt(0, 100), randInt(0, 100)];

    expect(a).toEqual(b);
  });

  it("produces different sequences for different seeds", () => {
    reseedRng(42);
    const a = [rand(), rand(), rand()];

    reseedRng(99);
    const b = [rand(), rand(), rand()];

    expect(a).not.toEqual(b);
  });

  it("rand() returns values in [0, 1)", () => {
    reseedRng(42);
    for (let i = 0; i < 1000; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("randInt() returns integers in [min, max] inclusive", () => {
    reseedRng(7);
    for (let i = 0; i < 500; i++) {
      const v = randInt(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("pick() returns an element from the array", () => {
    reseedRng(1);
    const arr = ["a", "b", "c"];
    for (let i = 0; i < 50; i++) {
      expect(arr).toContain(pick(arr));
    }
  });

  it("pickDistinct() returns N distinct elements", () => {
    reseedRng(1);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = pickDistinct(arr, 5);
    expect(result).toHaveLength(5);
    expect(new Set(result).size).toBe(5);
    result.forEach((v) => expect(arr).toContain(v));
  });

  it("stableHash is deterministic", () => {
    expect(stableHash("hello")).toBe(stableHash("hello"));
    expect(stableHash("hello")).not.toBe(stableHash("world"));
  });

  it("seededPin returns 6-digit strings", () => {
    const pin = seededPin("test-id");
    expect(pin).toMatch(/^\d{6}$/);
    expect(seededPin("test-id")).toBe(seededPin("test-id"));
  });
});

// ── Fee math ──────────────────────────────────────────────────────────

describe("computeFeeBreakdown", () => {
  const fees = CORPUS_VENUE.serviceFees; // Service 5%, TPS 5%, TVQ 9.975%

  it("computes percentage fees rounded to cents", () => {
    // $100.00 subtotal = 10000 cents
    const breakdown = computeFeeBreakdown(10000, fees);
    // Service 5% = 500, TPS 5% = 500, TVQ 9.975% = 998 (rounded)
    expect(breakdown).toHaveLength(3);
    expect(breakdown[0].amount).toBe(500);  // 5% of 10000
    expect(breakdown[1].amount).toBe(500);  // 5% of 10000
    expect(breakdown[2].amount).toBe(998);  // 9.975% of 10000 = 997.5 → 998
  });

  it("computes percentage fees on zero subtotal", () => {
    const breakdown = computeFeeBreakdown(0, fees);
    breakdown.forEach((b) => expect(b.amount).toBe(0));
  });

  it("computes flat fees in cents", () => {
    const flatFees = [
      { id: "fee-flat", name: "Flat Fee", type: "flat" as const, value: 5 },
    ];
    const breakdown = computeFeeBreakdown(1000, flatFees);
    expect(breakdown[0].amount).toBe(500); // $5.00 = 500 cents
  });

  it("returns integer cents for all percentage fees", () => {
    // Rounding to cents produces integers, tested across many values
    for (const cents of [0, 1, 99, 100, 101, 500, 999, 1000, 12345, 99999]) {
      const breakdown = computeFeeBreakdown(cents, fees);
      breakdown.forEach((b) => {
        expect(Number.isInteger(b.amount)).toBe(true);
      });
    }
  });
});

describe("totalFeeCents", () => {
  it("equals sum of computeFeeBreakdown amounts", () => {
    const subtotal = 12345;
    const total = totalFeeCents(subtotal);
    const sum = computeFeeBreakdown(subtotal, CORPUS_VENUE.serviceFees)
      .reduce((s, f) => s + f.amount, 0);
    expect(total).toBe(sum);
  });

  it("returns 0 for zero subtotal", () => {
    expect(totalFeeCents(0)).toBe(0);
  });
});

// ── Night volume model ─────────────────────────────────────────────────

describe("nightVolumeMultiplier", () => {
  const thu = new Date(2026, 6, 16); // Thursday
  const fri = new Date(2026, 6, 17); // Friday
  const sat = new Date(2026, 6, 18); // Saturday

  it("returns 0.6 for Thursday", () => {
    expect(nightVolumeMultiplier(thu)).toBe(0.6);
  });

  it("returns 1.0 for Friday", () => {
    expect(nightVolumeMultiplier(fri)).toBe(1.0);
  });

  it("returns 1.2 for Saturday", () => {
    expect(nightVolumeMultiplier(sat)).toBe(1.2);
  });

  it("returns 0.6 for non-open days (Sunday–Wednesday)", () => {
    for (let day = 0; day <= 3; day++) {
      const d = new Date(2026, 6, 12 + day); // Sun–Wed
      expect(nightVolumeMultiplier(d)).toBe(0.6);
    }
  });
});

describe("outlierMultiplier", () => {
  it("returns 1.0 for a non-outlier date", () => {
    // A date far from any defined outlier
    const d = daysAgo(100);
    expect(outlierMultiplier(d)).toBe(1.0);
  });

  it("returns correct multiplier for defined outliers", () => {
    for (const outlier of CORPUS_OUTLIERS) {
      const d = daysAgo(outlier.daysAgo);
      expect(outlierMultiplier(d)).toBe(outlier.volumeMultiplier);
    }
  });
});

// ── Business date ─────────────────────────────────────────────────────

describe("businessDateFor", () => {
  it("rolls over at nightEndHour — before rollover belongs to previous day", () => {
    // Jan 2 at 03:00 UTC, night end is 10 — 3 < 10 so business date is Jan 1
    const ts = "2026-01-02T03:00:00.000Z";
    expect(businessDateFor(ts, 10)).toBe("2026-01-01");
  });

  it("stays on same day after nightEndHour", () => {
    // Jan 2 at 14:00 UTC, night end is 10 — 14 >= 10 so business date is Jan 2
    const ts = "2026-01-02T14:00:00.000Z";
    expect(businessDateFor(ts, 10)).toBe("2026-01-02");
  });
});

// ── isOpenNight ───────────────────────────────────────────────────────

describe("isOpenNight", () => {
  it("returns true for Thursday, Friday, Saturday", () => {
    expect(isOpenNight(new Date(2026, 6, 16))).toBe(true); // Thu
    expect(isOpenNight(new Date(2026, 6, 17))).toBe(true); // Fri
    expect(isOpenNight(new Date(2026, 6, 18))).toBe(true); // Sat
  });

  it("returns false for Sunday–Wednesday", () => {
    for (let day = 0; day <= 3; day++) {
      expect(isOpenNight(new Date(2026, 6, 12 + day))).toBe(false);
    }
  });
});

// ── FullCorpus determinism ────────────────────────────────────────────

describe("generateFullCorpus", () => {
  it("produces different output for different seeds", () => {
    const a = JSON.stringify(generateFullCorpus(42));
    const b = JSON.stringify(generateFullCorpus(99));
    expect(a).not.toBe(b);
  });

  it("includes all top-level sections", () => {
    const corpus = generateFullCorpus(42);
    expect(corpus.venue).toBeDefined();
    expect(corpus.zones).toHaveLength(4);
    expect(corpus.tables.length).toBeGreaterThan(0);
    expect(corpus.roster.length).toBeGreaterThan(0);
    expect(corpus.menuItems.length).toBeGreaterThan(0);
    expect(corpus.nightlyHistory.length).toBeGreaterThan(0);
    expect(corpus.events.length).toBeGreaterThan(0);
    expect(corpus.reservations.length).toBeGreaterThan(0);
    expect(corpus.promotions.length).toBeGreaterThan(0);
    expect(corpus.presentTense).toBeDefined();
  });

  it("nightlyHistory covers only open nights in the 90-day window", () => {
    const corpus = generateFullCorpus(42);
    const dates = corpus.nightlyHistory.map((n) => n.nightDate);
    expect(dates.length).toBeGreaterThan(25); // ~39 open nights in 90 days
    expect(dates.length).toBeLessThanOrEqual(45);

    // All dates should be open nights (Thu/Fri/Sat)
    for (const dateStr of dates) {
      // Parse at noon to avoid UTC-midnight timezone shift
      expect(isOpenNight(new Date(dateStr + "T12:00:00"))).toBe(true);
    }

    // Dates should be distinct
    expect(new Set(dates).size).toBe(dates.length);

    // Dates should be in ascending order
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);
  });

  it("events include completed and upcoming events", () => {
    const corpus = generateFullCorpus(42);
    const statuses = new Set(corpus.events.map((e) => e.status));
    // Should have at least one "completed" and one "upcoming"
    expect(statuses.has("completed")).toBe(true);
    expect(statuses.has("upcoming")).toBe(true);
  });

  it("reservations include historical and future", () => {
    const corpus = generateFullCorpus(42);
    const hasFuture = corpus.reservations.some((r) => r.id.startsWith("res-future-"));
    const hasHistorical = corpus.reservations.some((r) => !r.id.startsWith("res-future-"));
    expect(hasFuture).toBe(true);
    expect(hasHistorical).toBe(true);
  });
});

// ── NightActivity integrity ───────────────────────────────────────────

describe("generateNightActivity", () => {
  const nightDate = new Date(2026, 6, 17); // Friday July 17 2026

  it("produces sessions and orders for an open night", () => {
    reseedRng(42);
    const activity = generateNightActivity(nightDate);
    expect(activity.nightDate).toBe(isoDate(nightDate));
    expect(activity.sessions.length).toBeGreaterThan(0);
    expect(activity.orders.length).toBeGreaterThan(0);
  });

  it("session IDs are unique within a night", () => {
    reseedRng(42);
    const activity = generateNightActivity(nightDate);
    const ids = activity.sessions.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("order IDs are unique within a night", () => {
    reseedRng(42);
    const activity = generateNightActivity(nightDate);
    const ids = activity.orders.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every order references a valid session", () => {
    reseedRng(42);
    const activity = generateNightActivity(nightDate);
    const sessionIds = new Set(activity.sessions.map((s) => s.id));
    for (const order of activity.orders) {
      expect(sessionIds.has(order.sessionId)).toBe(true);
    }
  });

  it("every order references a valid table and zone", () => {
    reseedRng(42);
    const activity = generateNightActivity(nightDate);
    const tableIds = new Set(CORPUS_TABLES.map((t) => t.id));
    const zoneIds: Set<string> = new Set(CORPUS_ZONES.map((z) => z.id));
    for (const order of activity.orders) {
      expect(tableIds.has(order.tableId)).toBe(true);
      expect(zoneIds.has(order.zoneId)).toBe(true);
    }
  });

  it("order money integrity: subtotal + serviceFee + tip ≈ total", () => {
    reseedRng(42);
    const activity = generateNightActivity(nightDate);
    for (const order of activity.orders) {
      const computed = order.subtotal + order.serviceFee + order.tip;
      // Allow 1 cent rounding tolerance (float ↔ cents roundtrip)
      expect(Math.abs(computed - order.total)).toBeLessThanOrEqual(0.02);
    }
  });

  it("fee breakdown per order sums to the order's serviceFee", () => {
    reseedRng(42);
    const activity = generateNightActivity(nightDate);
    for (const order of activity.orders) {
      const breakdownSum = order.feeBreakdown.reduce((s, fb) => s + fb.amount, 0);
      const expectedServiceFee = Math.round(order.serviceFee * 100);
      expect(Math.abs(breakdownSum - expectedServiceFee)).toBeLessThanOrEqual(1);
    }
  });

  it("stock movements have negative deltas for sales of alcoholic items", () => {
    reseedRng(42);
    const activity = generateNightActivity(nightDate);
    for (const sm of activity.stockMovements) {
      expect(sm.type).toBe("sale");
      expect(sm.delta).toBeLessThan(0);
      // menuItemId should reference a real item
      const item = CORPUS_MENU_ITEMS.find((mi) => mi.id === sm.menuItemId);
      expect(item).toBeDefined();
      expect(item!.isAlcoholic).toBe(true);
    }
  });

  it("sessions have valid status values", () => {
    reseedRng(42);
    const activity = generateNightActivity(nightDate);
    const validStatuses = new Set(["approved", "pending", "closed", "denied"]);
    for (const sess of activity.sessions) {
      expect(validStatuses.has(sess.status)).toBe(true);
    }
  });

  it("same seed produces identical night activity", () => {
    reseedRng(42);
    const a = JSON.stringify(generateNightActivity(nightDate));

    reseedRng(42);
    const b = JSON.stringify(generateNightActivity(nightDate));

    expect(a).toBe(b);
  });
});

// ── Present tense invariants ──────────────────────────────────────────

describe("generatePresentTense", () => {
  it("openSessions contain only approved or pending statuses", () => {
    const state = generatePresentTense();
    for (const sess of state.openSessions) {
      expect(["approved", "pending"]).toContain(sess.status);
    }
  });

  it("inFlightOrders are not delivered or cancelled", () => {
    const state = generatePresentTense();
    for (const order of state.inFlightOrders) {
      expect(order.status).not.toBe("delivered");
      expect(order.status).not.toBe("cancelled");
    }
  });

  it("unackedHelp has only pending status", () => {
    const state = generatePresentTense();
    for (const h of state.unackedHelp) {
      expect(h.status).toBe("pending");
    }
  });

  it("activeWaitlist has only waiting or notified status", () => {
    const state = generatePresentTense();
    const valid = new Set(["waiting", "notified"]);
    for (const w of state.activeWaitlist) {
      expect(valid.has(w.status)).toBe(true);
    }
  });
});

// ── Sub-generator sanity ──────────────────────────────────────────────

describe("generateGuestProfiles", () => {
  it("generates the requested count", () => {
    reseedRng(42);
    const profiles = generateGuestProfiles(30);
    expect(profiles).toHaveLength(30);
  });

  it("each profile has required fields", () => {
    reseedRng(42);
    const profiles = generateGuestProfiles(10);
    for (const p of profiles) {
      expect(p.id).toBeTruthy();
      expect(p.displayName).toBeTruthy();
      expect(p.visitCount).toBeGreaterThanOrEqual(0);
      expect(p.lifetimeNetCents).toBeGreaterThanOrEqual(0);
      expect(p.status).toBeTruthy();
    }
  });
});

describe("generateHistoricalEvents", () => {
  it("produces events with required structure", () => {
    // generateFullCorpus seeds internally; call standalone after reseed
    reseedRng(42);
    const events = generateHistoricalEvents();
    expect(events.length).toBeGreaterThanOrEqual(5);
    for (const e of events) {
      expect(e.id).toBeTruthy();
      expect(e.name).toBeTruthy();
      expect(e.startsAt).toBeTruthy();
      expect(e.endsAt).toBeTruthy();
      expect(e.status).toBeTruthy();
    }
  });
});

describe("generateHistoricalReservations", () => {
  it("produces reservations with required structure", () => {
    // generateFullCorpus re-seeds internally; test standalone call
    reseedRng(42);
    const reservations = generateHistoricalReservations();
    expect(reservations.length).toBeGreaterThan(0);
    for (const r of reservations) {
      expect(r.id).toBeTruthy();
      expect(r.guestName).toBeTruthy();
      expect(r.tableId).toBeTruthy();
      expect(r.status).toBeTruthy();
      expect(r.reservationPin).toMatch(/^\d{6}$/);
    }
  });
});

describe("generateHistoricalPromotions", () => {
  it("produces exactly 5 promotions", () => {
    reseedRng(42);
    const promos = generateHistoricalPromotions();
    expect(promos).toHaveLength(5);
  });

  it("each promotion has required fields and valid type", () => {
    reseedRng(42);
    const promos = generateHistoricalPromotions();
    const validTypes = new Set(["percentage", "flat"]);
    for (const p of promos) {
      expect(p.id).toBeTruthy();
      expect(p.code).toBeTruthy();
      expect(validTypes.has(p.type)).toBe(true);
      expect(p.value).toBeGreaterThan(0);
    }
  });
});

// ── Roster integrity ──────────────────────────────────────────────────

describe("CORPUS_ROSTER", () => {
  it("has exactly one manager", () => {
    const managers = CORPUS_ROSTER.filter((m) => m.role === "manager");
    expect(managers).toHaveLength(1);
  });

  it("has at least one of each required floor role", () => {
    const roles = new Set(CORPUS_ROSTER.map((m) => m.role));
    expect(roles.has("manager")).toBe(true);
    expect(roles.has("bartender")).toBe(true);
    expect(roles.has("runner")).toBe(true);
    expect(roles.has("host")).toBe(true);
    expect(roles.has("security")).toBe(true);
  });

  it("all IDs are unique", () => {
    const ids = CORPUS_ROSTER.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ── Menu integrity ────────────────────────────────────────────────────

describe("CORPUS_MENU_ITEMS", () => {
  it("all items belong to a valid category", () => {
    const cats = new Set([
      "cat-champagne", "cat-tequila", "cat-vodka", "cat-cognac",
      "cat-rhum", "cat-whisky", "cat-gin", "cat-washers",
    ]);
    for (const item of CORPUS_MENU_ITEMS) {
      expect(cats.has(item.categoryId)).toBe(true);
    }
  });

  it("all item IDs are unique", () => {
    const ids = CORPUS_MENU_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("prices are positive", () => {
    for (const item of CORPUS_MENU_ITEMS) {
      expect(item.price).toBeGreaterThan(0);
    }
  });
});

// ── Table integrity ───────────────────────────────────────────────────

describe("CORPUS_TABLES", () => {
  it("all tables reference a valid zone", () => {
    const zoneIds: Set<string> = new Set(CORPUS_ZONES.map((z) => z.id));
    for (const t of CORPUS_TABLES) {
      expect(zoneIds.has(t.zoneId)).toBe(true);
    }
  });

  it("all table IDs and codes are unique", () => {
    const ids = CORPUS_TABLES.map((t) => t.id);
    const codes = CORPUS_TABLES.map((t) => t.code);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("seats are at least 2", () => {
    for (const t of CORPUS_TABLES) {
      expect(t.seats).toBeGreaterThanOrEqual(2);
    }
  });
});
