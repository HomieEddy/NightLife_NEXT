import { describe, it, expect } from "vitest";
import { AUDIENCE_FILTER, isGuestVisible } from "./events";

describe("AUDIENCE_FILTER", () => {
  it("manager sees all event types", () => {
    expect(AUDIENCE_FILTER.manager.length).toBeGreaterThanOrEqual(18);
  });

  it("staff sees all event types", () => {
    expect(AUDIENCE_FILTER.staff).toEqual(AUDIENCE_FILTER.manager);
  });

  it("guest sees only session-relevant and venue-wide events", () => {
    const guest = new Set(AUDIENCE_FILTER.guest);

    expect(guest.has("OrderStatusChanged")).toBe(true);
    expect(guest.has("SessionApproved")).toBe(true);
    expect(guest.has("SessionDenied")).toBe(true);
    expect(guest.has("SessionClosed")).toBe(true);
    expect(guest.has("LastCallStarted")).toBe(true);
    expect(guest.has("LastCallEnded")).toBe(true);

    expect(guest.has("OrderPlaced")).toBe(false);
    expect(guest.has("OrderClaimed")).toBe(false);
    expect(guest.has("OrderReleased")).toBe(false);
    expect(guest.has("HelpRequested")).toBe(false);
    expect(guest.has("BroadcastSent")).toBe(false);
    expect(guest.has("ShowStarted")).toBe(false);
    expect(guest.has("ShowFinished")).toBe(false);
    expect(guest.has("SoldOut")).toBe(false);
    expect(guest.has("StockRestocked")).toBe(false);
  });
});

describe("isGuestVisible", () => {
  const ownSession = "session-abc";

  it("allows own-session OrderStatusChanged", () => {
    expect(isGuestVisible(
      { type: "OrderStatusChanged", sessionId: ownSession },
      ownSession,
    )).toBe(true);
  });

  it("blocks cross-table OrderStatusChanged", () => {
    expect(isGuestVisible(
      { type: "OrderStatusChanged", sessionId: "session-other" },
      ownSession,
    )).toBe(false);
  });

  it("allows venue-wide LastCallStarted regardless of sessionId", () => {
    expect(isGuestVisible(
      { type: "LastCallStarted" },
      ownSession,
    )).toBe(true);
  });

  it("allows venue-wide LastCallEnded regardless of sessionId", () => {
    expect(isGuestVisible(
      { type: "LastCallEnded" },
      ownSession,
    )).toBe(true);
  });

  it("allows own-session SessionApproved", () => {
    expect(isGuestVisible(
      { type: "SessionApproved", sessionId: ownSession },
      ownSession,
    )).toBe(true);
  });

  it("blocks cross-table SessionApproved", () => {
    expect(isGuestVisible(
      { type: "SessionApproved", sessionId: "session-other" },
      ownSession,
    )).toBe(false);
  });

  it("blocks non-guest event types entirely", () => {
    expect(isGuestVisible(
      { type: "OrderPlaced", sessionId: ownSession },
      ownSession,
    )).toBe(false);
  });

  it("blocks BroadcastSent even with matching sessionId", () => {
    expect(isGuestVisible(
      { type: "BroadcastSent", sessionId: ownSession },
      ownSession,
    )).toBe(false);
  });
});
