import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { execSync } from "node:child_process";
import { getDb, type SessionContext } from "./db";
import {
  createSession,
  getSession,
  listSessions,
  setSessionStatus,
  requestClosure,
  isValidTransition,
  createHelpRequest,
  listHelpRequests,
  setHelpRequestStatus,
} from "./session-core";
import { submitOrder } from "./order-core";
import { createCategory, createItem } from "./menu-core";
import { expectTenantIsolation } from "./test-helpers";
import { toCents } from "./money";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function makeVenue(rawClient: PrismaClient, name: string, slug: string, opts: { autoApprove?: boolean } = {}) {
  const org = await rawClient.organization.create({ data: { id: `org-${slug}`, name, slug } });
  await rawClient.venue.create({
    data: {
      id: org.id,
      address: "1 Test St",
      city: "Testville",
      timezone: "America/Montreal",
      currency: "CAD",
      openingHours: [],
      serviceFees: [],
      floorMap: { width: 16, height: 9 },
      autoApproveGuests: opts.autoApprove ?? false,
      logoInitials: "TT",
      slaThresholds: { orderWarnMinutes: 6, orderCriticalMinutes: 12, helpWarnMinutes: 4, helpCriticalMinutes: 8 },
      lastCallAutoFlagTables: true,
    },
  });
  return org.id;
}

async function makeTable(rawClient: PrismaClient, venueId: string, zoneId: string, code: string) {
  return rawClient.venueTable.create({
    data: {
      venueId,
      zoneId,
      code,
      label: `Table ${code}`,
      seats: 4,
      status: "open",
      qrSlug: `${code.toLowerCase()}-${Date.now()}`,
    },
  });
}

describe("guest sessions & help requests integration (plan 06)", () => {
  let container: StartedPostgreSqlContainer;
  let rawClient: PrismaClient;
  let venueA: string;
  let venueB: string;
  let ctxA: SessionContext;
  let zoneId: string;
  let tableId: string;
  let catId: string;
  let itemId: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:17-alpine").start();
    const url = container.getConnectionUri();

    execSync(`npx prisma migrate deploy`, {
      env: { ...process.env, DATABASE_URL: url },
      cwd: process.cwd(),
    });

    process.env.DATABASE_URL = url;
    process.env.AUTH_SECRET = "test-secret-at-least-16";
    process.env.QR_TOKEN_SECRET = "test-qr-secret-at-least-16-chars";

    const adapter = new PrismaPg(url);
    rawClient = new PrismaClient({ adapter });

    venueA = await makeVenue(rawClient, "Session Venue A", "session-a-int");
    venueB = await makeVenue(rawClient, "Session Venue B", "session-b-int");
    ctxA = { venueId: venueA };

    const zone = await rawClient.zone.create({
      data: { venueId: venueA, name: "VIP", color: "violet" },
    });
    zoneId = zone.id;

    const table = await makeTable(rawClient, venueA, zoneId, "VIP-01");
    tableId = table.id;

    const db = getDb(ctxA);
    const cat = await createCategory(db, venueA, { name: "Champagne", description: "", sortOrder: 1 });
    catId = cat.id;
    const item = await createItem(db, venueA, {
      categoryId: catId,
      name: "Dom Pérignon",
      description: "",
      priceCents: toCents(500),
      icon: "champagne",
      tags: [],
      inventory: 20,
    });
    itemId = item.id;
  }, 120_000);

  afterAll(async () => {
    await rawClient?.$disconnect();
    await container?.stop();
  });

  // ── Session state machine (INV-S1) ────────────────────────────────

  it("creates a pending session", async () => {
    const db = getDb(ctxA);
    const session = await createSession(db, venueA, {
      tableId,
      tableCode: "VIP-01",
      zoneName: "VIP",
      displayName: "Test + 3",
      partySize: 4,
    }, false);

    expect(session.status).toBe("pending");
    expect(session.partySize).toBe(4);
    expect(session.tableCode).toBe("VIP-01");
  });

  it("transitions pending → approved", async () => {
    const db = getDb(ctxA);
    const session = await createSession(db, venueA, {
      tableId, tableCode: "VIP-01", zoneName: "VIP",
      displayName: "Approve test", partySize: 2,
    }, false);

    const result = await setSessionStatus(db, session.id, "approved");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.session.status).toBe("approved");
  });

  it("transitions pending → denied", async () => {
    const db = getDb(ctxA);
    const session = await createSession(db, venueA, {
      tableId, tableCode: "VIP-01", zoneName: "VIP",
      displayName: "Deny test", partySize: 1,
    }, false);

    const result = await setSessionStatus(db, session.id, "denied");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.session.status).toBe("denied");
  });

  it("rejects illegal transition pending → closed", async () => {
    const db = getDb(ctxA);
    const session = await createSession(db, venueA, {
      tableId, tableCode: "VIP-01", zoneName: "VIP",
      displayName: "Illegal test", partySize: 1,
    }, false);

    const result = await setSessionStatus(db, session.id, "closed");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Cannot transition");
  });

  it("rejects illegal transition denied → approved", async () => {
    const db = getDb(ctxA);
    const session = await createSession(db, venueA, {
      tableId, tableCode: "VIP-01", zoneName: "VIP",
      displayName: "Denied2", partySize: 1,
    }, false);
    await setSessionStatus(db, session.id, "denied");

    const result = await setSessionStatus(db, session.id, "approved");
    expect(result.ok).toBe(false);
  });

  // ── Closure validation (INV-S2) ───────────────────────────────────

  it("rejects closure when in-flight orders exist", async () => {
    const db = getDb(ctxA);
    const session = await createSession(db, venueA, {
      tableId, tableCode: "VIP-01", zoneName: "VIP",
      displayName: "Closure test", partySize: 2,
    }, false);
    await setSessionStatus(db, session.id, "approved");

    await submitOrder(db, venueA, {
      tableId, tableCode: "VIP-01", zoneId, zoneName: "VIP",
      guestName: "Closure test", sessionId: session.id,
      lines: [{ menuItemId: itemId, quantity: 1, modifiers: [] }],
      tipCents: 0,
    });

    const result = await requestClosure(db, session.id);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("in flight");
  });

  it("allows closure when all orders are delivered", async () => {
    const db = getDb(ctxA);
    const session = await createSession(db, venueA, {
      tableId, tableCode: "VIP-01", zoneName: "VIP",
      displayName: "Delivered test", partySize: 2,
    }, false);
    await setSessionStatus(db, session.id, "approved");

    const orderResult = await submitOrder(db, venueA, {
      tableId, tableCode: "VIP-01", zoneId, zoneName: "VIP",
      guestName: "Delivered test", sessionId: session.id,
      lines: [{ menuItemId: itemId, quantity: 1, modifiers: [] }],
      tipCents: 0,
    });
    expect(orderResult.ok).toBe(true);
    if (!orderResult.ok) return;

    // Advance to delivered
    const { advanceOrder } = await import("./order-core");
    await advanceOrder(db, orderResult.order.id); // → accepted
    await advanceOrder(db, orderResult.order.id); // → preparing
    await advanceOrder(db, orderResult.order.id); // → ready
    await advanceOrder(db, orderResult.order.id); // → delivered

    const result = await requestClosure(db, session.id);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.session.status).toBe("closure-requested");
  });

  // ── Auto-approve ──────────────────────────────────────────────────

  it("auto-approves when venue setting is enabled", async () => {
    const autoVenueId = await makeVenue(rawClient, "Auto Venue", "auto-venue-int", { autoApprove: true });
    const autoZone = await rawClient.zone.create({
      data: { venueId: autoVenueId, name: "Auto Zone", color: "blue" },
    });
    const autoTable = await makeTable(rawClient, autoVenueId, autoZone.id, "A-01");

    const db = getDb({ venueId: autoVenueId });
    const session = await createSession(db, autoVenueId, {
      tableId: autoTable.id, tableCode: "A-01", zoneName: "Auto Zone",
      displayName: "Auto guest", partySize: 2,
    }, true);

    expect(session.status).toBe("approved");
  });

  // ── Revoked token (INV-S3) — existing session survives ────────────

  it("existing session survives token version bump", async () => {
    const db = getDb(ctxA);
    const session = await createSession(db, venueA, {
      tableId, tableCode: "VIP-01", zoneName: "VIP",
      displayName: "Revoke test", partySize: 2,
    }, false);
    await setSessionStatus(db, session.id, "approved");

    // Bump tokenVersion (simulates QR regeneration)
    await rawClient.venueTable.update({
      where: { id: tableId },
      data: { tokenVersion: 99 },
    });

    // Session still readable
    const loaded = await getSession(db, session.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.status).toBe("approved");
  });

  // ── Help request lifecycle ────────────────────────────────────────

  it("creates and manages help request lifecycle", async () => {
    const db = getDb(ctxA);
    const session = await createSession(db, venueA, {
      tableId, tableCode: "VIP-01", zoneName: "VIP",
      displayName: "Help test", partySize: 2,
    }, false);
    await setSessionStatus(db, session.id, "approved");

    const hr = await createHelpRequest(db, venueA, {
      sessionId: session.id,
      tableCode: "VIP-01",
      zoneName: "VIP",
      guestName: "Help test",
      type: "call-waiter",
    });

    expect(hr.status).toBe("open");
    expect(hr.type).toBe("call-waiter");
    expect(hr.sessionId).toBe(session.id);

    const acked = await setHelpRequestStatus(db, hr.id, "acknowledged");
    expect(acked!.status).toBe("acknowledged");

    const resolved = await setHelpRequestStatus(db, acked!.id, "resolved");
    expect(resolved!.status).toBe("resolved");

    const all = await listHelpRequests(db);
    expect(all.some((r) => r.id === hr.id)).toBe(true);
  });

  // ── Tenant isolation ──────────────────────────────────────────────

  it("enforces tenant isolation on guest sessions", async () => {
    const db = getDb(ctxA);
    const session = await createSession(db, venueA, {
      tableId, tableCode: "VIP-01", zoneName: "VIP",
      displayName: "Isolation test", partySize: 2,
    }, false);

    await expectTenantIsolation(venueA, venueB, (scopedDb) =>
      scopedDb.guestSession.findUnique({ where: { id: session.id } }),
    );
  });

  it("enforces tenant isolation on help requests", async () => {
    const db = getDb(ctxA);
    const session = await createSession(db, venueA, {
      tableId, tableCode: "VIP-01", zoneName: "VIP",
      displayName: "HR iso test", partySize: 2,
    }, false);
    await setSessionStatus(db, session.id, "approved");

    const hr = await createHelpRequest(db, venueA, {
      sessionId: session.id,
      tableCode: "VIP-01",
      zoneName: "VIP",
      guestName: "HR iso",
      type: "refill-ice",
    });

    await expectTenantIsolation(venueA, venueB, (scopedDb) =>
      scopedDb.helpRequest.findUnique({ where: { id: hr.id } }),
    );
  });

  // ── List + filter ─────────────────────────────────────────────────

  it("lists sessions with status filter", async () => {
    const db = getDb(ctxA);
    const pending = await listSessions(db, "pending");
    expect(pending.every((s) => s.status === "pending")).toBe(true);
  });

  // ── State machine validation helper ───────────────────────────────

  it("validates transition matrix", () => {
    expect(isValidTransition("pending", "approved")).toBe(true);
    expect(isValidTransition("pending", "denied")).toBe(true);
    expect(isValidTransition("pending", "closed")).toBe(false);
    expect(isValidTransition("approved", "closure-requested")).toBe(true);
    expect(isValidTransition("approved", "closed")).toBe(false);
    expect(isValidTransition("closure-requested", "closed")).toBe(true);
    expect(isValidTransition("denied", "approved")).toBe(false);
    expect(isValidTransition("closed", "pending")).toBe(false);
  });
});
