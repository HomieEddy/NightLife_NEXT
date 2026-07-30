import { describe, it, expect } from "vitest";
import { computeAttentionItems } from "./pulse";
import type { GuestSession, Order, TabAdjustment, VenueTable, Zone } from "./types";

const thresholds = { orderWarnMinutes: 6, orderCriticalMinutes: 12, helpWarnMinutes: 4, helpCriticalMinutes: 8 };

const table: VenueTable = {
  id: "t-1", zoneId: "z-1", code: "VIP-01", label: "Booth", seats: 6,
  minimumSpend: 800, status: "occupied", qrSlug: "vip-01",
};
const zone: Zone = { id: "z-1", venueId: "venue-1", name: "VIP", description: "", color: "violet", tableCount: 1, capacity: 60 };

function session(patch: Partial<GuestSession> = {}): GuestSession {
  return {
    id: "gs-1", tableId: "t-1", tableCode: "VIP-01", zoneName: "VIP", displayName: "Chloé",
    partySize: 4, status: "approved", createdAt: new Date().toISOString(), minimumSpendCents: 80000,
    ...patch,
  };
}

function order(total: number): Order {
  return {
    id: "ord-1", code: "A-001", venueId: "venue-1", sessionId: "gs-1", tableId: "t-1", tableCode: "VIP-01",
    zoneId: "z-1", zoneName: "VIP", guestName: "Chloé", items: [], subtotal: total, serviceFee: 0, tip: 0,
    total, status: "delivered", placedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
}

describe("computeAttentionItems — table-under-minimum (plan 16)", () => {
  it("flags an open session short of its minimum, only once last call is active", () => {
    const sessions = [session()];
    const orders = [order(300)]; // $300 of $800 minimum — 37.5% of minimum
    // Without last call, the mid-night progress check (RV-19) still fires because
    // progress is below the 50% checkpoint.
    const withoutLastCall = computeAttentionItems([], [], [table], [zone], thresholds, false, true, sessions, [], 0.25);
    // Mid-night progress fires a table-under-minimum item even without last call.
    expect(withoutLastCall.some((i) => i.type === "table-under-minimum")).toBe(true);

    const withLastCall = computeAttentionItems([], [], [table], [zone], thresholds, true, true, sessions, [], 0.25);
    const items = withLastCall.filter((i) => i.type === "table-under-minimum");
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items.some((i) => i.tableCode === "VIP-01")).toBe(true);
  });

  it("suppresses mid-night progress check when the session is well above minimum", () => {
    const sessions = [session()];
    const orders = [order(720)]; // $720 of $800 minimum — 90%, at or above all checkpoints [0.5, 0.75, 0.9]
    const items = computeAttentionItems(orders, [], [table], [zone], thresholds, false, true, sessions, [], 0.25);
    expect(items.some((i) => i.type === "table-under-minimum")).toBe(false);
  });

  it("does not flag a session that already met its minimum", () => {
    const sessions = [session()];
    const orders = [order(900)];
    const items = computeAttentionItems(orders, [], [table], [zone], thresholds, true, true, sessions, [], 0.25);
    expect(items.some((i) => i.type === "table-under-minimum")).toBe(false);
  });

  it("escalates to critical once the shortfall is at least double the warning ratio", () => {
    const sessions = [session()];
    const orders = [order(100)]; // shortfall ratio ~0.875, warning ratio 0.25 → critical
    const items = computeAttentionItems(orders, [], [table], [zone], thresholds, true, true, sessions, [], 0.25);
    const item = items.find((i) => i.type === "table-under-minimum");
    expect(item?.severity).toBe("critical");
  });

  it("nets adjustments into the shortfall check", () => {
    const sessions = [session()];
    const orders = [order(900)];
    const adjustments: TabAdjustment[] = [{
      id: "adj-1", venueId: "venue-1", sessionId: "gs-1", kind: "void", amountCents: 20000,
      reasonCode: "wrong-item", authorStaffId: "s-1", authorStaffName: "Nina", createdAt: new Date().toISOString(),
    }];
    // net = 900 - 200 = 700, still short of 800.
    const items = computeAttentionItems(orders, [], [table], [zone], thresholds, true, true, sessions, adjustments, 0.25);
    expect(items.some((i) => i.type === "table-under-minimum")).toBe(true);
  });
});
