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
  | "WalkoutReported"
  | "PurchaseOrderSubmitted"
  | "StockReceived"
  | "StocktakeCommitted"
  | "WasteRecorded"
  | "TargetBreached";

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
  // ponytail: always push to all subscribed staff; dedup/presence heuristics when scale demands
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

  // Push payloads are user-facing strings — resolve the venue's language so
  // staff at a francophone venue get French pushes (plan 34 workstream 8).
  const venue = await prisma.venue.findUnique({
    where: { id: event.venueId },
    select: { guestLocale: true },
  });
  const locale: "en" | "fr" = venue?.guestLocale === "fr" ? "fr" : "en";

  const { title, body, url } = pushPayloadFor(event, locale);
  await dispatchPush(db, {
    venueId: event.venueId,
    eventType: event.type,
    title,
    body,
    url,
    locale,
    idempotencyKey: `event:${event.type}:${event.venueId}:${Date.now()}`,
  });
}

type PushPayload = { title: string; body?: string; url?: string };

function pushPayloadFor(event: DomainEvent, locale: "en" | "fr"): PushPayload {
  const v = event.venueId;
  const p = event.payload;
  const fr = locale === "fr";
  switch (event.type) {
    case "OrderPlaced":
      return fr
        ? { title: "Nouvelle commande", body: `Nouvelle commande pour la table ${p.tableCode ?? "?"} — ${p.itemCount ?? "articles"}`, url: `/manager/orders?highlight=${p.orderId ?? ""}` }
        : { title: "New order", body: `New order for table ${p.tableCode ?? "?"} — ${p.itemCount ?? "items"}`, url: `/manager/orders?highlight=${p.orderId ?? ""}` };
    case "OrderStatusChanged":
      return fr
        ? { title: "Commande mise à jour", body: `Commande ${(p.orderId as string)?.slice(-6) ?? ""} → ${p.status ?? "mise à jour"}`, url: `/manager/orders?highlight=${p.orderId ?? ""}` }
        : { title: "Order updated", body: `Order ${(p.orderId as string)?.slice(-6) ?? ""} → ${p.status ?? "updated"}`, url: `/manager/orders?highlight=${p.orderId ?? ""}` };
    case "OrderClaimed":
      return fr
        ? { title: "Commande réclamée", body: `${p.staffName ?? "Un membre du personnel"} a réclamé la commande ${(p.orderId as string)?.slice(-6) ?? ""}`, url: `/staff/orders?highlight=${p.orderId ?? ""}` }
        : { title: "Order claimed", body: `${p.staffName ?? "A staff member"} claimed order ${(p.orderId as string)?.slice(-6) ?? ""}`, url: `/staff/orders?highlight=${p.orderId ?? ""}` };
    case "OrderReleased":
      return fr
        ? { title: "Commande relâchée", body: `Commande ${(p.orderId as string)?.slice(-6) ?? ""} remise dans la file`, url: `/staff/orders` }
        : { title: "Order released", body: `Order ${(p.orderId as string)?.slice(-6) ?? ""} released back to pool`, url: `/staff/orders` };
    case "HelpRequested":
      return fr
        ? { title: "Aide demandée", body: `Table ${p.tableCode ?? "?"} a besoin d'aide — ${p.note ?? ""}`, url: `/staff/help?highlight=${p.requestId ?? ""}` }
        : { title: "Help requested", body: `Table ${p.tableCode ?? "?"} needs help — ${p.note ?? ""}`, url: `/staff/help?highlight=${p.requestId ?? ""}` };
    case "SessionRequested":
      return fr
        ? { title: "Session demandée", body: `Table ${p.tableCode ?? "?"} veut ouvrir une session`, url: `/staff/approvals` }
        : { title: "Session requested", body: `Table ${p.tableCode ?? "?"} wants to start a session`, url: `/staff/approvals` };
    case "SessionApproved":
      return fr
        ? { title: "Session approuvée", body: `La session de la table ${p.tableCode ?? "?"} est active`, url: `/manager/orders?sessionId=${p.sessionId ?? ""}` }
        : { title: "Session approved", body: `Session for table ${p.tableCode ?? "?"} is now active`, url: `/manager/orders?sessionId=${p.sessionId ?? ""}` };
    case "SessionDenied":
      return fr
        ? { title: "Session refusée", body: `La session de la table ${p.tableCode ?? "?"} a été refusée`, url: `/manager/orders` }
        : { title: "Session denied", body: `Session for table ${p.tableCode ?? "?"} was denied`, url: `/manager/orders` };
    case "BroadcastSent":
      return { title: (p.title as string) ?? (fr ? "Annonce au personnel" : "Staff announcement"), body: (p.body as string) ?? "", url: `/staff` };
    case "LastCallStarted":
      return fr
        ? { title: "Dernier appel", body: "Le dernier appel a commencé — plus aucune nouvelle commande acceptée.", url: `/staff` }
        : { title: "Last call", body: "Last call has started — no new orders accepted.", url: `/staff` };
    case "LastCallEnded":
      return fr
        ? { title: "Dernier appel terminé", body: "Le dernier appel est terminé.", url: `/staff` }
        : { title: "Last call ended", body: "Last call has ended.", url: `/staff` };
    case "SoldOut":
      return fr
        ? { title: "Article épuisé", body: `${p.itemName ?? "Un article"} est 86`, url: `/manager/menu` }
        : { title: "Item sold out", body: `${p.itemName ?? "An item"} is now 86'd`, url: `/manager/menu` };
    case "StockRestocked":
      return fr
        ? { title: "Article réapprovisionné", body: `${p.itemName ?? "Un article"} est de retour en stock`, url: `/manager/menu` }
        : { title: "Item restocked", body: `${p.itemName ?? "An item"} is back in stock`, url: `/manager/menu` };
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
