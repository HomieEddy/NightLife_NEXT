/**
 * Domain event publishing: INSERT into domain_events (audit) + pg_notify
 * on a venue-scoped channel. SSE stream endpoints subscribe to NOTIFY.
 */
import type { Prisma } from "@prisma/client";
import { getRawPrisma } from "@/features/shared/db";

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
  | "ShowFinished"
  | "TabAdjusted"
  | "SessionTransferred"
  | "SessionsMerged"
  | "CashoutClosed"
  | "OrdersReassigned"
  | "WalkoutReported";

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
  // Fire-and-forget push dispatch — non-blocking so SSE latency not impacted.
  // v1 simplification: always push to subscribed staff; dedup/presence
  // heuristics are a TODO(backend) earned by real complaint, not speculation.
  try {
    await dispatchPushForEvent(event);
  } catch {
    // push failure must never break the SSE pipeline
  }
}

async function dispatchPushForEvent(event: DomainEvent): Promise<void> {
  const pushEventTypes: DomainEventType[] = [
    "OrderPlaced", "OrderStatusChanged", "OrderClaimed", "OrderReleased",
    "HelpRequested", "SessionRequested", "SessionApproved", "SessionDenied",
    "BroadcastSent", "LastCallStarted", "LastCallEnded",
    "SoldOut", "StockRestocked",
  ];
  if (!pushEventTypes.includes(event.type)) return;

  const { dispatchPush } = await import("@/features/notifications/dispatch");
  const prisma = getRawPrisma();
  const db = prisma;

  const { title, body, url } = pushPayloadFor(event);
  await dispatchPush(db, {
    venueId: event.venueId,
    eventType: event.type,
    title,
    body,
    url,
    idempotencyKey: `event:${event.type}:${event.venueId}:${Date.now()}`,
  });
}

type PushPayload = { title: string; body?: string; url?: string };

function pushPayloadFor(event: DomainEvent): PushPayload {
  const v = event.venueId;
  const p = event.payload;
  switch (event.type) {
    case "OrderPlaced":
      return { title: "New order", body: `New order for table ${p.tableCode ?? "?"} — ${p.itemCount ?? "items"}`, url: `/manager/orders?highlight=${p.orderId ?? ""}` };
    case "OrderStatusChanged":
      return { title: "Order updated", body: `Order ${(p.orderId as string)?.slice(-6) ?? ""} → ${p.status ?? "updated"}`, url: `/manager/orders?highlight=${p.orderId ?? ""}` };
    case "OrderClaimed":
      return { title: "Order claimed", body: `${p.staffName ?? "A staff member"} claimed order ${(p.orderId as string)?.slice(-6) ?? ""}`, url: `/staff/orders?highlight=${p.orderId ?? ""}` };
    case "OrderReleased":
      return { title: "Order released", body: `Order ${(p.orderId as string)?.slice(-6) ?? ""} released back to pool`, url: `/staff/orders` };
    case "HelpRequested":
      return { title: "Help requested", body: `Table ${p.tableCode ?? "?"} needs help — ${p.note ?? ""}`, url: `/staff/help?highlight=${p.requestId ?? ""}` };
    case "SessionRequested":
      return { title: "Session requested", body: `Table ${p.tableCode ?? "?"} wants to start a session`, url: `/staff/approvals` };
    case "SessionApproved":
      return { title: "Session approved", body: `Session for table ${p.tableCode ?? "?"} is now active`, url: `/manager/orders?sessionId=${p.sessionId ?? ""}` };
    case "SessionDenied":
      return { title: "Session denied", body: `Session for table ${p.tableCode ?? "?"} was denied`, url: `/manager/orders` };
    case "BroadcastSent":
      return { title: (p.title as string) ?? "Staff announcement", body: (p.body as string) ?? "", url: `/staff` };
    case "LastCallStarted":
      return { title: "Last call", body: "Last call has started — no new orders accepted.", url: `/staff` };
    case "LastCallEnded":
      return { title: "Last call ended", body: "Last call has ended.", url: `/staff` };
    case "SoldOut":
      return { title: "Item sold out", body: `${p.itemName ?? "An item"} is now 86'd`, url: `/manager/menu` };
    case "StockRestocked":
      return { title: "Item restocked", body: `${p.itemName ?? "An item"} is back in stock`, url: `/manager/menu` };
    default:
      return { title: event.type };
  }
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
