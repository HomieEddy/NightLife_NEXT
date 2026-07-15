/**
 * Domain event publishing: INSERT into domain_events (audit) + pg_notify
 * on a venue-scoped channel. SSE stream endpoints subscribe to NOTIFY.
 */
import type { Prisma } from "@prisma/client";
import { getRawPrisma } from "@/server/db";

export type DomainEventType =
  | "OrderPlaced"
  | "OrderStatusChanged"
  | "OrderClaimed"
  | "OrderReleased"
  | "GiftSent"
  | "SessionRequested"
  | "SessionApproved"
  | "SessionDenied"
  | "ClosureRequested"
  | "SessionClosed"
  | "HelpRequested"
  | "HelpStatusChanged"
  | "SoldOut"
  | "StockRestocked"
  | "BroadcastSent"
  | "LastCallStarted"
  | "LastCallEnded"
  | "ShowStarted"
  | "ShowFinished";

export interface DomainEvent {
  type: DomainEventType;
  venueId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>;
}

const CHANNEL_PREFIX = "venue_events_";

export function channelFor(venueId: string): string {
  return `${CHANNEL_PREFIX}${venueId}`;
}

/**
 * Persist the event then NOTIFY listeners. Both happen in the same
 * database round-trip when possible — the NOTIFY fires at commit time
 * so subscribers never see a notification without the row existing.
 */
export async function publish(event: DomainEvent): Promise<void> {
  const prisma = getRawPrisma();
  await prisma.$transaction((tx) => publishInTransaction(tx, event));
}

export async function publishInTransaction(
  tx: Prisma.TransactionClient,
  event: DomainEvent,
): Promise<void> {
  const channel = channelFor(event.venueId);
  const message = JSON.stringify({ type: event.type, ...event.payload });

  await tx.domainEvent.create({
    data: {
      venueId: event.venueId,
      type: event.type,
      payload: event.payload,
    },
  });
  await tx.$executeRawUnsafe(`SELECT pg_notify($1, $2)`, channel, message);
}

/**
 * Audience filter: which event types each role stream should receive.
 * Guests only see events scoped to their own session/table.
 */
export const AUDIENCE_FILTER: Record<"manager" | "staff" | "guest", DomainEventType[]> = {
  manager: [
    "OrderPlaced",
    "OrderStatusChanged",
    "OrderClaimed",
    "OrderReleased",
    "GiftSent",
    "SessionRequested",
    "SessionApproved",
    "SessionDenied",
    "ClosureRequested",
    "SessionClosed",
    "HelpRequested",
    "HelpStatusChanged",
    "SoldOut",
    "StockRestocked",
    "BroadcastSent",
    "LastCallStarted",
    "LastCallEnded",
    "ShowStarted",
    "ShowFinished",
  ],
  staff: [
    "OrderPlaced",
    "OrderStatusChanged",
    "OrderClaimed",
    "OrderReleased",
    "GiftSent",
    "SessionRequested",
    "SessionApproved",
    "SessionDenied",
    "ClosureRequested",
    "SessionClosed",
    "HelpRequested",
    "HelpStatusChanged",
    "SoldOut",
    "StockRestocked",
    "BroadcastSent",
    "LastCallStarted",
    "LastCallEnded",
    "ShowStarted",
    "ShowFinished",
  ],
  guest: [
    "OrderStatusChanged",
    "SessionApproved",
    "SessionDenied",
    "SessionClosed",
    "LastCallStarted",
    "LastCallEnded",
  ],
};

/**
 * For guest streams: filter events to only those relevant to a specific
 * session, preventing cross-table data leaks.
 */
export function isGuestVisible(
  event: { type: string; sessionId?: string; tableId?: string },
  guestSessionId: string,
): boolean {
  if (!AUDIENCE_FILTER.guest.includes(event.type as DomainEventType)) return false;
  if (event.type === "LastCallStarted" || event.type === "LastCallEnded") return true;
  return event.sessionId === guestSessionId;
}
