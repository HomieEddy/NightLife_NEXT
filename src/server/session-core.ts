/**
 * Guest session lifecycle + help requests.
 * State machine (INV-S1): pending → approved | denied; approved → closure-requested → closed.
 * Closure validation (INV-S2): requestClosure rejects when in-flight orders exist.
 */
import type { getDb } from "./db";
import { publish } from "./events";
import type { GuestSession, GuestSessionStatus, HelpRequest, HelpRequestType, HelpRequestStatus } from "@/lib/types";
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
  const row = await db.guestSession.create({
    data: {
      ...input,
      venueId,
      status: autoApprove ? "approved" : "pending",
    },
  });
  const session = toSession(row);
  await publish({
    type: autoApprove ? "SessionApproved" : "SessionRequested",
    venueId,
    payload: { sessionId: session.id, tableId: input.tableId },
  });
  return session;
}

export async function setSessionStatus(
  db: ScopedDb,
  sessionId: string,
  newStatus: GuestSessionStatus,
): Promise<{ ok: true; session: GuestSession } | { ok: false; error: string }> {
  const row = await db.guestSession.findUnique({ where: { id: sessionId } });
  if (!row) return { ok: false, error: "Session not found" };

  const currentStatus = PRISMA_TO_DOMAIN[row.status];
  if (!isValidTransition(currentStatus, newStatus)) {
    return { ok: false, error: `Cannot transition from ${currentStatus} to ${newStatus}` };
  }

  const updated = await db.guestSession.update({
    where: { id: sessionId },
    data: { status: DOMAIN_TO_PRISMA[newStatus] },
  });
  const session = toSession(updated);

  const EVENT_MAP: Partial<Record<GuestSessionStatus, "SessionApproved" | "SessionDenied" | "SessionClosed">> = {
    approved: "SessionApproved",
    denied: "SessionDenied",
    closed: "SessionClosed",
  };
  const eventType = EVENT_MAP[newStatus];
  if (eventType) {
    await publish({
      type: eventType,
      venueId: row.venueId,
      payload: { sessionId, tableId: row.tableId },
    });
  }

  return { ok: true, session };
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
