/**
 * Guest session lifecycle + help requests.
 * State machine (INV-S1): pending → approved | denied; approved → closure-requested → closed.
 * Closure validation (INV-S2): requestClosure rejects when in-flight orders exist.
 */
import type { getDb } from "./db";
import { getRawPrisma } from "./db";
import { publish, publishInTransaction } from "./events";
import type { GuestSession, GuestSessionStatus, HelpRequest, HelpRequestType, HelpRequestStatus, SettlementMethod } from "@/lib/types";
import type { GuestSessionStatus as PrismaSessionStatus, OrderStatus } from "@prisma/client";

type ScopedDb = ReturnType<typeof getDb>;

// ── Status mapping ───────────────────────────────────────────────────

const DOMAIN_TO_PRISMA: Record<GuestSessionStatus, PrismaSessionStatus> = {
  pending: "pending",
  approved: "approved",
  denied: "denied",
  "closure-requested": "closure_requested",
  closed: "closed",
};

const PRISMA_TO_DOMAIN: Record<PrismaSessionStatus, GuestSessionStatus> = {
  pending: "pending",
  approved: "approved",
  denied: "denied",
  closure_requested: "closure-requested",
  closed: "closed",
};

// ── Valid transitions (INV-S1) ───────────────────────────────────────

const VALID_TRANSITIONS: Record<GuestSessionStatus, GuestSessionStatus[]> = {
  pending: ["approved", "denied"],
  approved: ["closure-requested"],
  denied: [],
  "closure-requested": ["closed"],
  closed: [],
};

export function isValidTransition(from: GuestSessionStatus, to: GuestSessionStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── Row → domain mapper ─────────────────────────────────────────────

interface SessionRow {
  id: string;
  tableId: string;
  tableCode: string;
  zoneName: string;
  displayName: string;
  partySize: number;
  status: PrismaSessionStatus;
  createdAt: Date;
  settledExternallyAt: Date | null;
  settlementMethod: string | null;
}

function toSession(row: SessionRow): GuestSession {
  return {
    id: row.id,
    tableId: row.tableId,
    tableCode: row.tableCode,
    zoneName: row.zoneName,
    displayName: row.displayName,
    partySize: row.partySize,
    status: PRISMA_TO_DOMAIN[row.status],
    createdAt: row.createdAt.toISOString(),
    settledExternallyAt: row.settledExternallyAt?.toISOString(),
    settlementMethod: row.settlementMethod as SettlementMethod | undefined,
  };
}

interface HelpRow {
  id: string;
  sessionId: string;
  tableCode: string;
  zoneName: string;
  guestName: string;
  type: string;
  status: string;
  createdAt: Date;
}

function toHelpRequest(row: HelpRow): HelpRequest {
  return {
    id: row.id,
    sessionId: row.sessionId,
    tableCode: row.tableCode,
    zoneName: row.zoneName,
    guestName: row.guestName,
    type: row.type as HelpRequestType,
    status: row.status as HelpRequestStatus,
    createdAt: row.createdAt.toISOString(),
  };
}

// ── Queries ──────────────────────────────────────────────────────────

export async function listSessions(
  db: ScopedDb,
  status?: GuestSessionStatus,
): Promise<GuestSession[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (status) where.status = DOMAIN_TO_PRISMA[status];

  const rows = await db.guestSession.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toSession);
}

export async function getSession(
  db: ScopedDb,
  sessionId: string,
): Promise<GuestSession | null> {
  const row = await db.guestSession.findUnique({ where: { id: sessionId } });
  return row ? toSession(row) : null;
}

export async function createSession(
  db: ScopedDb,
  venueId: string,
  input: {
    tableId: string;
    tableCode: string;
    zoneName: string;
    displayName: string;
    partySize: number;
  },
  autoApprove: boolean,
): Promise<GuestSession> {
  if (!autoApprove) {
    const row = await db.guestSession.create({ data: { ...input, venueId, status: "pending" } });
    const session = toSession(row);
    await publish({ type: "SessionRequested", venueId, payload: { sessionId: session.id, tableId: input.tableId } });
    return session;
  }

  const row = await getRawPrisma().$transaction(async (tx) => {
    const tables = await tx.$queryRawUnsafe<{ status: string }[]>(
      `SELECT status FROM venue_tables WHERE id = $1 AND venue_id = $2 FOR UPDATE`,
      input.tableId,
      venueId,
    );
    if (!tables[0] || tables[0].status === "closed") throw new Error("Table is not available");
    const active = await tx.guestSession.count({
      where: { venueId, tableId: input.tableId, status: { in: ["approved", "closure_requested"] } },
    });
    if (active > 0) throw new Error("Table already has an active session");
    const created = await tx.guestSession.create({ data: { ...input, venueId, status: "approved" } });
    await tx.venueTable.update({ where: { id: input.tableId }, data: { status: "occupied" } });
    await publishInTransaction(tx, {
      type: "SessionApproved",
      venueId,
      payload: { sessionId: created.id, tableId: input.tableId },
    });
    return created;
  });
  return toSession(row);
}

export async function setSessionStatus(
  db: ScopedDb,
  sessionId: string,
  newStatus: GuestSessionStatus,
  settlementMethod?: SettlementMethod,
): Promise<{ ok: true; session: GuestSession } | { ok: false; error: string }> {
  const row = await db.guestSession.findUnique({ where: { id: sessionId } });
  if (!row) return { ok: false, error: "Session not found" };

  const currentStatus = PRISMA_TO_DOMAIN[row.status];
  if (!isValidTransition(currentStatus, newStatus)) {
    return { ok: false, error: `Cannot transition from ${currentStatus} to ${newStatus}` };
  }

  const EVENT_MAP: Partial<Record<GuestSessionStatus, "SessionApproved" | "SessionDenied" | "SessionClosed">> = {
    approved: "SessionApproved",
    denied: "SessionDenied",
    closed: "SessionClosed",
  };
  if (newStatus === "closed" && !settlementMethod) {
    return { ok: false, error: "Settlement method is required" };
  }

  try {
    const updated = await getRawPrisma().$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        `SELECT id FROM venue_tables WHERE id = $1 AND venue_id = $2 FOR UPDATE`,
        row.tableId,
        row.venueId,
      );
      const locked = await tx.guestSession.findFirst({ where: { id: sessionId, venueId: row.venueId } });
      if (!locked) throw new Error("Session not found");
      const lockedStatus = PRISMA_TO_DOMAIN[locked.status];
      if (!isValidTransition(lockedStatus, newStatus)) {
        throw new Error(`Cannot transition from ${lockedStatus} to ${newStatus}`);
      }

      if (newStatus === "approved") {
        const active = await tx.guestSession.count({
          where: {
            venueId: row.venueId,
            tableId: row.tableId,
            id: { not: sessionId },
            status: { in: ["approved", "closure_requested"] },
          },
        });
        if (active > 0) throw new Error("Table already has an active session");
        await tx.venueTable.update({ where: { id: row.tableId }, data: { status: "occupied" } });
      }

      if (newStatus === "closed") {
        const inFlight = await tx.order.count({
          where: { venueId: row.venueId, sessionId, status: { in: IN_FLIGHT_STATUSES } },
        });
        if (inFlight > 0) throw new Error(`${inFlight} order(s) still in flight`);
        const now = new Date();
        const reservation = await tx.reservation.findFirst({
          where: {
            venueId: row.venueId,
            tableId: row.tableId,
            status: "confirmed",
            startsAt: { lte: now },
            OR: [{ endsAt: null }, { endsAt: { gte: now } }],
          },
        });
        await tx.venueTable.update({
          where: { id: row.tableId },
          data: { status: reservation ? "reserved" : "open" },
        });
      }

      const next = await tx.guestSession.update({
        where: { id: sessionId },
        data: {
          status: DOMAIN_TO_PRISMA[newStatus],
          settledExternallyAt: newStatus === "closed" ? new Date() : undefined,
          settlementMethod: newStatus === "closed" ? settlementMethod : undefined,
        },
      });
      const eventType = EVENT_MAP[newStatus];
      if (eventType) {
        await publishInTransaction(tx, {
          type: eventType,
          venueId: row.venueId,
          payload: { sessionId, tableId: row.tableId },
        });
      }
      return next;
    });
    return { ok: true, session: toSession(updated) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Session update failed" };
  }
}

// ── Closure validation (INV-S2) ─────────────────────────────────────

const IN_FLIGHT_STATUSES: OrderStatus[] = ["pending", "accepted", "preparing", "ready"];

export async function requestClosure(
  db: ScopedDb,
  sessionId: string,
): Promise<{ ok: true; session: GuestSession } | { ok: false; error: string }> {
  const session = await db.guestSession.findUnique({ where: { id: sessionId } });
  if (!session) return { ok: false, error: "Session not found" };

  const currentStatus = PRISMA_TO_DOMAIN[session.status];
  if (currentStatus !== "approved") {
    return { ok: false, error: `Cannot request closure from ${currentStatus}` };
  }

  const inFlightCount = await db.order.count({
    where: {
      sessionId,
      status: { in: IN_FLIGHT_STATUSES },
    },
  });
  if (inFlightCount > 0) {
    return { ok: false, error: `${inFlightCount} order(s) still in flight` };
  }

  const updated = await db.guestSession.update({
    where: { id: sessionId },
    data: { status: "closure_requested" },
  });
  await publish({
    type: "ClosureRequested",
    venueId: session.venueId,
    payload: { sessionId, tableId: session.tableId },
  });
  return { ok: true, session: toSession(updated) };
}

// ── Help requests ────────────────────────────────────────────────────

export async function listHelpRequests(
  db: ScopedDb,
  status?: HelpRequestStatus,
): Promise<HelpRequest[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (status) where.status = status;

  const rows = await db.helpRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toHelpRequest);
}

export async function createHelpRequest(
  db: ScopedDb,
  venueId: string,
  input: {
    sessionId: string;
    tableCode: string;
    zoneName: string;
    guestName: string;
    type: HelpRequestType;
  },
): Promise<HelpRequest> {
  const row = await db.helpRequest.create({ data: { ...input, venueId } });
  const request = toHelpRequest(row);
  await publish({
    type: "HelpRequested",
    venueId,
    payload: { requestId: request.id, sessionId: input.sessionId, type: input.type },
  });
  return request;
}

export async function setHelpRequestStatus(
  db: ScopedDb,
  requestId: string,
  status: HelpRequestStatus,
): Promise<HelpRequest | null> {
  const existing = await db.helpRequest.findUnique({ where: { id: requestId } });
  if (!existing) return null;

  const updated = await db.helpRequest.update({
    where: { id: requestId },
    data: { status },
  });
  const request = toHelpRequest(updated);
  await publish({
    type: "HelpStatusChanged",
    venueId: existing.venueId,
    payload: { requestId, status, sessionId: existing.sessionId },
  });
  return request;
}
