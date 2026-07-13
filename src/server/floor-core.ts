/**
 * Floor coordination: broadcasts, last call, show lock, chat.
 * All writes publish domain events for SSE delivery.
 */
import type { getDb } from "./db";
import { getRawPrisma } from "./db";
import { publish } from "./events";
import type { ActiveShow, Broadcast, ChatMessage } from "@/lib/types";
import type { StaffRole } from "@/lib/types";

type ScopedDb = ReturnType<typeof getDb>;

// ── Broadcasts (append-only) ────────────────────────────────────────

function toBroadcast(row: { id: string; message: string; sentBy: string; sentAt: Date }): Broadcast {
  return {
    id: row.id,
    message: row.message,
    sentBy: row.sentBy,
    sentAt: row.sentAt.toISOString(),
  };
}

export async function listBroadcasts(db: ScopedDb): Promise<Broadcast[]> {
  const rows = await db.broadcast.findMany({ orderBy: { sentAt: "desc" } });
  return rows.map(toBroadcast);
}

export async function sendBroadcast(
  db: ScopedDb,
  venueId: string,
  message: string,
  sentBy: string,
): Promise<Broadcast> {
  const row = await db.broadcast.create({ data: { venueId, message, sentBy } });
  const broadcast = toBroadcast(row);

  const channels: ChatMessage["channel"][] = ["floor", "bar", "security"];
  for (const channel of channels) {
    await db.chatMessage.create({
      data: {
        venueId,
        channel,
        authorId: "manager-broadcast",
        authorName: sentBy,
        authorRole: "manager",
        body: `${sentBy}: ${message}`,
      },
    });
  }

  await publish({
    type: "BroadcastSent",
    venueId,
    payload: { broadcastId: broadcast.id, message, sentBy },
  });

  return broadcast;
}

// ── Last call (venue singleton) ─────────────────────────────────────

export async function getLastCallState(
  db: ScopedDb,
  venueId: string,
): Promise<{ active: boolean; startedAt: string | null }> {
  const row = await db.venueFloorState.findUnique({ where: { venueId } });
  if (!row) return { active: false, startedAt: null };
  return {
    active: row.lastCallActive,
    startedAt: row.lastCallStartedAt?.toISOString() ?? null,
  };
}

async function ensureFloorState(venueId: string) {
  const prisma = getRawPrisma();
  await prisma.venueFloorState.upsert({
    where: { venueId },
    create: { venueId },
    update: {},
  });
}

export async function startLastCall(
  db: ScopedDb,
  venueId: string,
  sentBy: string,
): Promise<void> {
  await ensureFloorState(venueId);
  await db.venueFloorState.update({
    where: { venueId },
    data: {
      lastCallActive: true,
      lastCallStartedAt: new Date(),
      lastCallStartedBy: sentBy,
    },
  });

  const channels: ChatMessage["channel"][] = ["floor", "bar", "security"];
  for (const channel of channels) {
    await db.chatMessage.create({
      data: {
        venueId,
        channel,
        authorId: "manager-broadcast",
        authorName: sentBy,
        authorRole: "manager",
        body: `${sentBy} started last call — no new orders are being accepted.`,
      },
    });
  }

  await publish({
    type: "LastCallStarted",
    venueId,
    payload: { startedBy: sentBy },
  });
}

export async function endLastCall(
  db: ScopedDb,
  venueId: string,
): Promise<void> {
  await ensureFloorState(venueId);
  await db.venueFloorState.update({
    where: { venueId },
    data: {
      lastCallActive: false,
      lastCallStartedAt: null,
      lastCallStartedBy: null,
    },
  });

  await publish({ type: "LastCallEnded", venueId, payload: {} });
}

// ── Show lock (INV-F1: SELECT … FOR UPDATE) ─────────────────────────

function toActiveShow(row: {
  orderId: string;
  tableCode: string;
  zoneName: string;
  label: string;
  staffName: string;
  startedAt: Date;
}): ActiveShow {
  return {
    orderId: row.orderId,
    tableCode: row.tableCode,
    zoneName: row.zoneName,
    label: row.label,
    staffName: row.staffName,
    startedAt: row.startedAt.toISOString(),
  };
}

export async function getActiveShow(
  db: ScopedDb,
): Promise<ActiveShow | null> {
  const row = await db.activeShowLock.findFirst();
  return row ? toActiveShow(row) : null;
}

export async function startShow(
  venueId: string,
  orderId: string,
  tableCode: string,
  zoneName: string,
  label: string,
  staffName: string,
): Promise<{ ok: boolean; activeShow: ActiveShow | null }> {
  const prisma = getRawPrisma();

  try {
    const show = await prisma.$transaction(async (tx) => {
      // INV-F1: row-level lock prevents two concurrent startShow calls
      const existing = await tx.$queryRawUnsafe<{ id: string; order_id: string; table_code: string; zone_name: string; label: string; staff_name: string; started_at: Date }[]>(
        `SELECT id, order_id, table_code, zone_name, label, staff_name, started_at
         FROM active_show_locks
         WHERE venue_id = $1
         FOR UPDATE`,
        venueId,
      );

      if (existing.length > 0) {
        const row = existing[0];
        return {
          ok: false as const,
          activeShow: toActiveShow({
            orderId: row.order_id,
            tableCode: row.table_code,
            zoneName: row.zone_name,
            label: row.label,
            staffName: row.staff_name,
            startedAt: row.started_at,
          }),
        };
      }

      const created = await tx.activeShowLock.create({
        data: { venueId, orderId, tableCode, zoneName, label, staffName },
      });

      return { ok: true as const, activeShow: toActiveShow(created) };
    });

    if (show.ok) {
      await publish({
        type: "ShowStarted",
        venueId,
        payload: { orderId, tableCode, label, staffName },
      });
    }

    return show;
  } catch {
    // Unique constraint violation = concurrent insert race
    const db2 = await prisma.activeShowLock.findFirst({ where: { venueId } });
    return { ok: false, activeShow: db2 ? toActiveShow(db2) : null };
  }
}

export async function finishShow(
  venueId: string,
): Promise<void> {
  const prisma = getRawPrisma();
  await prisma.activeShowLock.deleteMany({ where: { venueId } });

  await publish({ type: "ShowFinished", venueId, payload: {} });
}

// ── Chat messages (append-only ledger) ──────────────────────────────

function toChatMessage(row: {
  id: string;
  channel: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  body: string;
  sentAt: Date;
}): ChatMessage {
  return {
    id: row.id,
    channel: row.channel as ChatMessage["channel"],
    authorId: row.authorId,
    authorName: row.authorName,
    authorRole: row.authorRole as StaffRole,
    body: row.body,
    sentAt: row.sentAt.toISOString(),
  };
}

export async function listMessages(
  db: ScopedDb,
  channel: ChatMessage["channel"],
): Promise<ChatMessage[]> {
  const rows = await db.chatMessage.findMany({
    where: { channel },
    orderBy: { sentAt: "asc" },
  });
  return rows.map(toChatMessage);
}

export async function sendMessage(
  db: ScopedDb,
  venueId: string,
  input: {
    channel: ChatMessage["channel"];
    authorId: string;
    authorName: string;
    authorRole: StaffRole;
    body: string;
  },
): Promise<ChatMessage> {
  const row = await db.chatMessage.create({
    data: {
      venueId,
      channel: input.channel,
      authorId: input.authorId,
      authorName: input.authorName,
      authorRole: input.authorRole,
      body: input.body,
    },
  });
  return toChatMessage(row);
}
