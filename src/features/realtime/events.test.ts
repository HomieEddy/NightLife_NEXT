import { describe, it, expect } from "vitest";
import { AUDIENCE_FILTER, passesAudienceFilter } from "@/features/realtime/events";

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

describe("passesAudienceFilter", () => {
  const ownSession = "session-abc";

  it("allows own-session OrderStatusChanged", () => {
    expect(passesAudienceFilter(
      { type: "OrderStatusChanged", sessionId: ownSession },
      "guest",
      ownSession,
    )).toBe(true);
  });

  it("blocks cross-table OrderStatusChanged", () => {
    expect(passesAudienceFilter(
      { type: "OrderStatusChanged", sessionId: "session-other" },
      "guest",
      ownSession,
    )).toBe(false);
  });

  it("allows venue-wide LastCallStarted regardless of sessionId", () => {
    expect(passesAudienceFilter(
      { type: "LastCallStarted" },
      "guest",
      ownSession,
    )).toBe(true);
  });

  it("allows venue-wide LastCallEnded regardless of sessionId", () => {
    expect(passesAudienceFilter(
      { type: "LastCallEnded" },
      "guest",
      ownSession,
    )).toBe(true);
  });

  it("allows own-session SessionApproved", () => {
    expect(passesAudienceFilter(
      { type: "SessionApproved", sessionId: ownSession },
      "guest",
      ownSession,
    )).toBe(true);
  });

  it("blocks cross-table SessionApproved", () => {
    expect(passesAudienceFilter(
      { type: "SessionApproved", sessionId: "session-other" },
      "guest",
      ownSession,
    )).toBe(false);
  });

  it("blocks non-guest event types entirely", () => {
    expect(passesAudienceFilter(
      { type: "OrderPlaced", sessionId: ownSession },
      "guest",
      ownSession,
    )).toBe(false);
  });

  it("blocks BroadcastSent even with matching sessionId", () => {
    expect(passesAudienceFilter(
      { type: "BroadcastSent", sessionId: ownSession },
      "guest",
      ownSession,
    )).toBe(false);
  });

  it("manager scope passes any manager-allowed event", () => {
    expect(passesAudienceFilter(
      { type: "OrderPlaced" },
      "manager",
    )).toBe(true);
    expect(passesAudienceFilter(
      { type: "SomeUnknownType" },
      "manager",
    )).toBe(false);
  });

  it("guest scope with no session bound passes any guest-allowed event", () => {
    expect(passesAudienceFilter(
      { type: "OrderStatusChanged", sessionId: "someone-else" },
      "guest",
    )).toBe(true);
  });
});
