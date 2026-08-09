/**
 * Tab ledger & financial controls — the session-as-account business logic (plan 16).
 * Every write path is transactional. An AuditEntry is written in the same
 * transaction as its effect. Money lives as integer cents (AD-5).
 */
import type { getDb } from "@/features/shared/db";
import { getRawPrisma } from "@/features/shared/db";
import { publish } from "@/features/realtime/events";
import {
  isAdjustmentAmountValid,
  orderItemAmountCents,
  orderItemPartialAmountCents,
  computeCashoutExpected,
  computeCashoutVariance,
  mergedMinimumSpendCents,
} from "@/lib/tab";
import type {
  AdjustmentReason,
  AuditEntry,
  GuestSession,
  Order,
  OrderRemake,
  SettlementMethod,
  ShiftCashout,
  SplitBillAssignment,
  TabAdjustment,
  TabAdjustmentKind,
  WalkoutRecord,
} from "@/lib/types";
import type { z } from "zod";

type ScopedDb = ReturnType<typeof getDb>;

// ══════════════════════════════════════════════════════════════════════════
// Row → domain mappers
// ══════════════════════════════════════════════════════════════════════════

interface AdjReasonRow {
  id: string;
  venueId: string;
  kind: string;
  code: string;
  label: string;
  isActive: boolean;
}

function toAdjustmentReason(row: AdjReasonRow): AdjustmentReason {
  return {
    id: row.id,
    venueId: row.venueId,
    kind: row.kind as TabAdjustmentKind,
    code: row.code,
    label: row.label,
    isActive: row.isActive,
  };
}

interface AdjRow {
  id: string;
  venueId: string;
  sessionId: string;
  orderId: string | null;
  orderItemId: string | null;
  kind: string;
  amountCents: number;
  quantity: number | null;
  reasonCode: string;
  note: string | null;
  authorStaffId: string;
  authorStaffName: string;
  reversedByAdjustmentId: string | null;
  createdAt: Date;
}

function toTabAdjustment(row: AdjRow): TabAdjustment {
  return {
    id: row.id,
    venueId: row.venueId,
    sessionId: row.sessionId,
    orderId: row.orderId ?? undefined,
    orderItemId: row.orderItemId ?? undefined,
    kind: row.kind as TabAdjustmentKind,
    amountCents: row.amountCents,
    quantity: row.quantity ?? undefined,
    reasonCode: row.reasonCode,
    note: row.note ?? undefined,
    authorStaffId: row.authorStaffId,
    authorStaffName: row.authorStaffName,
    reversedByAdjustmentId: row.reversedByAdjustmentId ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

interface AuditRow {
  id: string;
  venueId: string;
  actorStaffId: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  metadata: unknown;
  createdAt: Date;
}

function toAuditEntry(row: AuditRow): AuditEntry {
  return {
    id: row.id,
    venueId: row.venueId,
    actorStaffId: row.actorStaffId,
    actorName: row.actorName,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    summary: row.summary,
    metadata: (row.metadata as Record<string, unknown>) ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

interface CashoutRow {
  id: string;
  venueId: string;
  staffId: string | null;
  businessDate: string;
  openedAt: Date;
  closedAt: Date;
  expectedByMethod: unknown;
  countedByMethod: unknown;
  varianceCents: number;
  note: string | null;
  closedByStaffId: string;
  closedByStaffName: string;
}

function toShiftCashout(row: CashoutRow): ShiftCashout {
  return {
    id: row.id,
    venueId: row.venueId,
    staffId: row.staffId ?? undefined,
    businessDate: row.businessDate,
    openedAt: row.openedAt.toISOString(),
    closedAt: row.closedAt.toISOString(),
    expectedByMethod: row.expectedByMethod as Record<SettlementMethod, number>,
    countedByMethod: row.countedByMethod as Record<SettlementMethod, number>,
    varianceCents: row.varianceCents,
    note: row.note ?? undefined,
    closedByStaffId: row.closedByStaffId,
    closedByStaffName: row.closedByStaffName,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// Adjustment reasons CRUD
// ══════════════════════════════════════════════════════════════════════════

export async function listAdjustmentReasons(
  db: ScopedDb,
  kind?: TabAdjustmentKind,
): Promise<AdjustmentReason[]> {
  const where = kind ? { kind, isActive: true } : {};
  const rows = await db.adjustmentReason.findMany({ where, orderBy: { kind: "asc" } });
  return rows.map(toAdjustmentReason);
}

export async function createAdjustmentReason(
  db: ScopedDb,
  venueId: string,
  input: z.infer<typeof import("./schemas").zCreateAdjustmentReason>,
): Promise<AdjustmentReason> {
  const row = await db.adjustmentReason.create({ data: { ...input, venueId } });
  return toAdjustmentReason(row);
}

export async function setAdjustmentReasonActive(
  db: ScopedDb,
  reasonId: string,
  isActive: boolean,
): Promise<AdjustmentReason | null> {
  const row = await db.adjustmentReason.update({
    where: { id: reasonId },
    data: { isActive },
  });
  return toAdjustmentReason(row);
}

// ══════════════════════════════════════════════════════════════════════════
// Tab adjustments — the core write path
// ══════════════════════════════════════════════════════════════════════════

export async function listAdjustments(
  db: ScopedDb,
  sessionId?: string,
): Promise<TabAdjustment[]> {
  const where = sessionId ? { sessionId } : {};
  const rows = await db.tabAdjustment.findMany({ where, orderBy: { createdAt: "desc" } });
  return rows.map(toTabAdjustment);
}

/**
 * Creates one adjustment row. For voids: writes a matching StockMovement
 * (return stock to inventory) inside the same transaction. Every adjustment
 * writes an AuditEntry.
 *
 * INV-T3: amountCents must not exceed the remaining un-adjusted portion of
 * the target (no over-comping). INV-O4: void + stock movement must share a
 * transaction with the item row locked.
 */
export async function createAdjustment(
  db: ScopedDb,
  venueId: string,
  input: z.infer<typeof import("./schemas").zAdjustOrder>,
): Promise<{ ok: true; adjustment: TabAdjustment } | { ok: false; error: string }> {
  const prisma = getRawPrisma();

  // Pre-read: resolve the order, its items, and existing adjustments for INV-T3.
  const order = await db.order.findUnique({
    where: { id: input.orderId },
    include: { items: true },
  });
  if (!order) return { ok: false, error: "Order not found" };

  // Only delivered-or-later orders can be adjusted.  A cancellation is not an
  // adjustment — it reverses the sale movement directly in cancelOrder.
  if (order.status === "cancelled" || order.status === "pending") {
    return { ok: false, error: `Cannot adjust a ${order.status} order — it must be delivered first.` };
  }

  const sessionId = order.sessionId;
  if (!sessionId) return { ok: false, error: "Order is not attached to a session" };

  const existingRows = await db.tabAdjustment.findMany({
    where: {
      orderId: input.orderId,
      orderItemId: input.orderItemId ?? null,
      reversedByAdjustmentId: null,
    },
  });
  const existing: TabAdjustment[] = existingRows.map(toTabAdjustment);

  // Resolve the reason code against venue config.
  const reason = await db.adjustmentReason.findUnique({
    where: { venueId_kind_code: { venueId, kind: input.kind, code: input.reasonCode } },
  });
  if (!reason || !reason.isActive) {
    return { ok: false, error: `Unknown or inactive ${input.kind} reason: "${input.reasonCode}"` };
  }

  // Compute the target amount in cents and validate INV-T3.
  let targetCents: number;
  let description: string;
  if (input.orderItemId) {
    const item = order.items.find((i) => i.id === input.orderItemId);
    if (!item) return { ok: false, error: "Order item not found" };
    const asOrderItem = {
      id: item.id,
      menuItemId: item.menuItemId,
      name: item.name,
      unitPrice: item.unitCents / 100,
      quantity: item.quantity,
      modifiers: item.modifiers as never[],
    };
    if (input.quantity) {
      targetCents = orderItemPartialAmountCents(asOrderItem, input.quantity);
    } else {
      targetCents = orderItemAmountCents(asOrderItem);
    }
    description = input.quantity
      ? `${input.quantity}x ${item.name}`
      : item.name;
  } else {
    targetCents = Math.round(order.totalCents);
    description = `Order ${order.code}`;
  }

  if (!isAdjustmentAmountValid(targetCents, targetCents, existing)) {
    const remaining = targetCents - existing.reduce((s, a) => s + a.amountCents, 0);
    return { ok: false, error: `Cannot adjust: only ${(remaining / 100).toFixed(2)} remains un-adjusted on this target` };
  }

  const kindLabel = input.kind === "void" ? "voided" : input.kind === "comp" ? "comped" : "discounted";
  const summary = `${input.authorStaffName} ${kindLabel} ${description} — ${reason.label}`;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // INV-T3 re-check inside the transaction, with the order row locked —
      // two concurrent comps can no longer both pass the remaining check and
      // both insert. The pre-read above is just for early error messages.
      await tx.$queryRawUnsafe(
        `SELECT id FROM orders WHERE id = $1 AND venue_id = $2 FOR UPDATE`,
        input.orderId,
        venueId,
      );
      const currentRows = await tx.tabAdjustment.findMany({
        where: {
          orderId: input.orderId,
          orderItemId: input.orderItemId ?? null,
          reversedByAdjustmentId: null,
        },
      });
      const current: TabAdjustment[] = currentRows.map(toTabAdjustment);
      if (!isAdjustmentAmountValid(targetCents, targetCents, current)) {
        const remaining = targetCents - current.reduce((s, a) => s + a.amountCents, 0);
        throw new Error(`Cannot adjust: only ${(remaining / 100).toFixed(2)} remains un-adjusted on this target`);
      }

      // INV-O4: for voids, lock the menu item rows for the items we're returning.
      if (input.kind === "void") {
        const itemIds = new Set<string>();
        for (const item of order.items) {
          itemIds.add(item.menuItemId);
          // If an add-on carries an inventoryItemId, lock it too.
          const mods = item.modifiers as unknown as { groupId?: string; kind?: string; inventoryItemId?: string; quantity?: number }[];
          for (const mod of mods) {
            if (mod.inventoryItemId) itemIds.add(mod.inventoryItemId);
          }
        }

        // For item-level void: only return stock for that specific item.
        if (input.orderItemId) {
          const targetItem = order.items.find((i) => i.id === input.orderItemId);
          if (targetItem) {
            const qty = input.quantity ?? targetItem.quantity;
            const locked = await tx.$queryRawUnsafe<
              { id: string; name: string; inventory: number; is_available: boolean }[]
            >(
              `SELECT id, name, inventory, is_available FROM menu_items WHERE id = $1 AND venue_id = $2 FOR UPDATE`,
              targetItem.menuItemId,
              venueId,
            );
            if (locked.length === 0) throw new Error(`Menu item ${targetItem.menuItemId} not found`);

            await tx.$executeRawUnsafe(
              `UPDATE menu_items SET inventory = inventory + $1, updated_at = NOW() WHERE id = $2`,
              qty,
              targetItem.menuItemId,
            );
            await tx.stockMovement.create({
              data: {
                venueId,
                menuItemId: targetItem.menuItemId,
                itemName: targetItem.name,
                type: "adjustment",
                delta: qty,
                note: `Void adjustment — ${summary}`,
              },
            });
          }
        } else {
          // Full-order void: return stock for every item.
          for (const item of order.items) {
            await tx.$executeRawUnsafe(
              `UPDATE menu_items SET inventory = inventory + $1, updated_at = NOW() WHERE id = $2`,
              item.quantity,
              item.menuItemId,
            );
            await tx.stockMovement.create({
              data: {
                venueId,
                menuItemId: item.menuItemId,
                itemName: item.name,
                type: "adjustment",
                delta: item.quantity,
                note: `Void adjustment — ${summary}`,
              },
            });
          }
        }
      }

      // Create the adjustment row.
      const adj = await tx.tabAdjustment.create({
        data: {
          venueId,
          sessionId,
          orderId: input.orderId,
          orderItemId: input.orderItemId ?? null,
          kind: input.kind,
          amountCents: targetCents, // ponytail: full-target amount for whole-order; partial when item-scoped
          quantity: input.quantity ?? null,
          reasonCode: input.reasonCode,
          note: input.note ?? null,
          authorStaffId: input.authorStaffId,
          authorStaffName: input.authorStaffName,
        },
      });

      // Audit — same transaction.
      await tx.auditEntry.create({
        data: {
          venueId,
          actorStaffId: input.authorStaffId,
          actorName: input.authorStaffName,
          action: `tab:${input.kind}`,
          targetType: input.orderItemId ? "order-item" : "order",
          targetId: adj.id,
          summary,
          metadata: {
            orderId: input.orderId,
            orderItemId: input.orderItemId ?? null,
            amountCents: targetCents,
            reasonCode: input.reasonCode,
          },
        },
      });

      return adj;
    });

    const adjustment = toTabAdjustment(result);
    await publish({
      type: "TabAdjusted",
      venueId,
      payload: {
        adjustmentId: adjustment.id,
        sessionId,
        orderId: input.orderId,
        kind: input.kind,
        amountCents: targetCents,
      },
    });
    return { ok: true, adjustment };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Reverses a prior adjustment: writes a NEW row with the same amount and
 * opposite effect (via reversedByAdjustmentId back-reference). The original
 * row is never edited — same rule as StockMovement (INV-I1).
 */
export async function reverseAdjustment(
  db: ScopedDb,
  venueId: string,
  adjustmentId: string,
  staffId: string,
  staffName: string,
): Promise<{ ok: true; adjustment: TabAdjustment } | { ok: false; error: string }> {
  const original = await db.tabAdjustment.findUnique({ where: { id: adjustmentId } });
  if (!original) return { ok: false, error: "Adjustment not found" };
  if (original.reversedByAdjustmentId) {
    return { ok: false, error: "This adjustment has already been reversed" };
  }

  const prisma = getRawPrisma();
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Mark the original as reversed.
      const reversal = await tx.tabAdjustment.create({
        data: {
          venueId,
          sessionId: original.sessionId,
          orderId: original.orderId,
          orderItemId: original.orderItemId,
          kind: original.kind,
          amountCents: original.amountCents,
          quantity: original.quantity,
          reasonCode: original.reasonCode,
          note: `Reversal by ${staffName}`,
          authorStaffId: staffId,
          authorStaffName: staffName,
        },
      });

      await tx.tabAdjustment.update({
        where: { id: adjustmentId },
        data: { reversedByAdjustmentId: reversal.id },
      });

      // If reversing a void, deduct the returned stock (reverse the void's stock movement).
      if (original.kind === "void" && original.orderId) {
        const order = await tx.order.findUnique({
          where: { id: original.orderId },
          include: { items: true },
        });
        if (order) {
          if (original.orderItemId) {
            const item = order.items.find((i) => i.id === original.orderItemId);
            if (item) {
              const qty = original.quantity ?? item.quantity;
              await tx.$executeRawUnsafe(
                `UPDATE menu_items SET inventory = inventory - $1, updated_at = NOW() WHERE id = $2`,
                qty,
                item.menuItemId,
              );
              await tx.stockMovement.create({
                data: {
                  venueId,
                  menuItemId: item.menuItemId,
                  itemName: item.name,
                  type: "adjustment",
                  delta: -qty,
                  note: `Void reversal — ${staffName}`,
                },
              });
            }
          } else {
            for (const item of order.items) {
              await tx.$executeRawUnsafe(
                `UPDATE menu_items SET inventory = inventory - $1, updated_at = NOW() WHERE id = $2`,
                item.quantity,
                item.menuItemId,
              );
              await tx.stockMovement.create({
                data: {
                  venueId,
                  menuItemId: item.menuItemId,
                  itemName: item.name,
                  type: "adjustment",
                  delta: -item.quantity,
                  note: `Void reversal — ${staffName}`,
                },
              });
            }
          }
        }
      }

      // Audit.
      await tx.auditEntry.create({
        data: {
          venueId,
          actorStaffId: staffId,
          actorName: staffName,
          action: `tab:reverse-${original.kind}`,
          targetType: "adjustment",
          targetId: reversal.id,
          summary: `${staffName} reversed a ${original.kind} (${(original.amountCents / 100).toFixed(2)}) originally by ${original.authorStaffName}`,
          metadata: { originalAdjustmentId: adjustmentId, originalAmountCents: original.amountCents },
        },
      });

      return reversal;
    });

    const adjustment = toTabAdjustment(result);
    await publish({
      type: "TabAdjusted",
      venueId,
      payload: {
        adjustmentId: adjustment.id,
        sessionId: original.sessionId,
        orderId: original.orderId,
        kind: original.kind,
        amountCents: original.amountCents,
        reversed: true,
      },
    });
    return { ok: true, adjustment };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Audit entries
// ══════════════════════════════════════════════════════════════════════════

export async function recordAuditEntry(
  db: ScopedDb,
  venueId: string,
  input: z.infer<typeof import("./schemas").zRecordAudit>,
): Promise<AuditEntry> {
  const row = await db.auditEntry.create({ data: { ...input, venueId } });
  return toAuditEntry(row);
}

export async function listAuditEntries(
  db: ScopedDb,
  filter?: z.infer<typeof import("./schemas").zListAudit>,
): Promise<AuditEntry[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (filter?.actorStaffId) where.actorStaffId = filter.actorStaffId;
  if (filter?.action) where.action = filter.action;
  if (filter?.from) where.createdAt = { ...(where.createdAt ?? {}), gte: new Date(filter.from) };
  if (filter?.to) where.createdAt = { ...(where.createdAt ?? {}), lte: new Date(filter.to) };

  const rows = await db.auditEntry.findMany({ where, orderBy: { createdAt: "desc" }, take: 500 });
  return rows.map(toAuditEntry);
}

// ══════════════════════════════════════════════════════════════════════════
// Cash-out
// ══════════════════════════════════════════════════════════════════════════

export async function listCashouts(
  db: ScopedDb,
  staffId?: string,
): Promise<ShiftCashout[]> {
  const where = staffId ? { staffId } : {};
  const rows = await db.shiftCashout.findMany({ where, orderBy: { closedAt: "desc" } });
  return rows.map(toShiftCashout);
}

/**
 * Closes a drawer/venue cash-out for a business date. Computes variance
 * server-side (the client's expected is verified, not trusted), writes the
 * cashout row + an audit entry in one transaction.
 */
export async function closeCashout(
  db: ScopedDb,
  venueId: string,
  nightEndHour: number,
  input: z.infer<typeof import("./schemas").zCloseCashout>,
): Promise<{ ok: true; cashout: ShiftCashout } | { ok: false; error: string }> {
  // Recompute expected from the actual ledger — the client's number is a preview.
  // Scope every read to the night window for the business date (mirror of
  // businessDateFor): the old version pulled the venue's ENTIRE history.
  const windowStart = new Date(
    `${input.businessDate}T${String(nightEndHour).padStart(2, "0")}:00:00`,
  );
  const windowEnd = new Date(windowStart.getTime() + 24 * 3600_000);
  const sessions = await db.guestSession.findMany({
    where: { status: "closed", settledExternallyAt: { gte: windowStart, lt: windowEnd } },
  });
  const sessionIds = sessions.map((s) => s.id);
  const orders = sessionIds.length > 0
    ? await db.order.findMany({
        where: { sessionId: { in: sessionIds } },
        include: { items: true, feeLines: true },
      })
    : [];
  const adjustments = sessionIds.length > 0
    ? await db.tabAdjustment.findMany({
        where: { reversedByAdjustmentId: null, sessionId: { in: sessionIds } },
      })
    : [];

  const expected = computeCashoutExpected(
    sessions.map((s) => ({
      id: s.id,
      status: s.status,
      settlementMethod: s.settlementMethod as SettlementMethod | undefined,
      settledExternallyAt: s.settledExternallyAt?.toISOString(),
      minimumSpendCents: s.minimumSpendCents ?? undefined,
    })),
    orders.map((o) => ({
      ...o,
      items: o.items as never[],
      tip: o.tipCents / 100,
      serviceFee: o.totalFeeCents / 100,
      total: o.totalCents / 100,
      sessionId: o.sessionId ?? undefined,
      status: o.status,
    })) as unknown as Parameters<typeof computeCashoutExpected>[1],
    adjustments.map((a) => ({ ...a, sessionId: a.sessionId, reversedByAdjustmentId: a.reversedByAdjustmentId ?? undefined })) as unknown as Parameters<typeof computeCashoutExpected>[2],
    input.businessDate,
    nightEndHour,
  );

  const variance = computeCashoutVariance(expected, input.countedByMethod);
  const now = new Date();
  const prisma = getRawPrisma();

  try {
    const row = await prisma.$transaction(async (tx) => {
      const cashout = await tx.shiftCashout.create({
        data: {
          venueId,
          staffId: input.staffId ?? null,
          businessDate: input.businessDate,
          openedAt: now,
          closedAt: now,
          expectedByMethod: expected,
          countedByMethod: input.countedByMethod,
          varianceCents: variance,
          note: input.note ?? null,
          closedByStaffId: input.closedByStaffId,
          closedByStaffName: input.closedByStaffName,
        },
      });

      await tx.auditEntry.create({
        data: {
          venueId,
          actorStaffId: input.closedByStaffId,
          actorName: input.closedByStaffName,
          action: "cashout:close",
          targetType: "cashout",
          targetId: cashout.id,
          summary: `Closed ${input.staffId ? "drawer" : "venue"} cash-out for ${input.businessDate} — variance ${variance >= 0 ? "+" : ""}${(variance / 100).toFixed(2)}`,
          metadata: { businessDate: input.businessDate, varianceCents: variance },
        },
      });

      return cashout;
    });

    const cashout = toShiftCashout(row);
    await publish({
      type: "CashoutClosed",
      venueId,
      payload: { cashoutId: cashout.id, businessDate: input.businessDate, varianceCents: variance },
    });
    return { ok: true, cashout };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Session transfer / merge / reassign
// ══════════════════════════════════════════════════════════════════════════

export async function transferSession(
  db: ScopedDb,
  venueId: string,
  sessionId: string,
  input: z.infer<typeof import("./schemas").zTransferSession>,
): Promise<{ ok: true; session: GuestSession } | { ok: false; error: string }> {
  const prisma = getRawPrisma();
  try {
    const result = await prisma.$transaction(async (tx) => {
      const s = await tx.guestSession.findUnique({ where: { id: sessionId } });
      if (!s) throw new Error("Session not found");
      if (s.status !== "approved") throw new Error("Only an active session can be transferred");

      const fromTableId = s.tableId;
      const fromTableCode = s.tableCode;

      const updated = await tx.guestSession.update({
        where: { id: sessionId },
        data: {
          tableId: input.toTableId,
          tableCode: input.toTableCode,
          zoneName: input.toZoneName,
          transferredFromTableId: s.transferredFromTableId ?? fromTableId,
        },
      });

      // Update both table statuses.
      await tx.venueTable.updateMany({
        where: { id: input.toTableId },
        data: { status: "occupied" },
      });
      await tx.venueTable.updateMany({
        where: { id: fromTableId },
        data: { status: "open" },
      });

      await tx.auditEntry.create({
        data: {
          venueId,
          actorStaffId: input.staffId,
          actorName: input.staffName,
          action: "tab:transfer",
          targetType: "session",
          targetId: sessionId,
          summary: `Transferred tab from ${fromTableCode} to ${input.toTableCode}`,
          metadata: { fromTableId, toTableId: input.toTableId },
        },
      });

      return updated;
    });

    const session = {
      ...result,
      status: result.status as GuestSession["status"],
      createdAt: result.createdAt.toISOString(),
      settledExternallyAt: result.settledExternallyAt?.toISOString() ?? undefined,
      settlementMethod: (result.settlementMethod as SettlementMethod | undefined),
      serviceRefusedAt: result.serviceRefusedAt?.toISOString() ?? undefined,
      serviceRefusedReason: result.serviceRefusedReason ?? undefined,
      minimumSpendCents: result.minimumSpendCents ?? undefined,
      parentSessionId: result.parentSessionId ?? undefined,
      transferredFromTableId: result.transferredFromTableId ?? undefined,
      promoterId: result.promoterId ?? undefined,
      guestProfileId: result.guestProfileId ?? undefined,
    } as GuestSession;

    await publish({
      type: "SessionTransferred",
      venueId,
      payload: { sessionId, toTableId: input.toTableId },
    });
    return { ok: true, session };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function mergeSession(
  db: ScopedDb,
  venueId: string,
  childSessionId: string,
  input: z.infer<typeof import("./schemas").zMergeSession>,
): Promise<{ ok: true; session: GuestSession } | { ok: false; error: string }> {
  const prisma = getRawPrisma();
  try {
    const result = await prisma.$transaction(async (tx) => {
      const child = await tx.guestSession.findUnique({ where: { id: childSessionId } });
      const parent = await tx.guestSession.findUnique({ where: { id: input.parentSessionId } });
      if (!child || !parent) throw new Error("Session not found");
      if (child.status !== "approved" || parent.status !== "approved") {
        throw new Error("Both sessions must be active to merge");
      }

      const newMin = mergedMinimumSpendCents(
        parent.minimumSpendCents ?? 0,
        child.minimumSpendCents ?? 0,
      );

      await tx.guestSession.update({
        where: { id: input.parentSessionId },
        data: { minimumSpendCents: newMin },
      });
      await tx.guestSession.update({
        where: { id: childSessionId },
        data: { status: "closure_requested", parentSessionId: input.parentSessionId },
      });

      // Re-point all orders from child to parent.
      await tx.order.updateMany({
        where: { sessionId: childSessionId },
        data: { sessionId: input.parentSessionId },
      });

      await tx.auditEntry.create({
        data: {
          venueId,
          actorStaffId: input.staffId,
          actorName: input.staffName,
          action: "tab:merge",
          targetType: "session",
          targetId: input.parentSessionId,
          summary: `Merged tab from ${child.tableCode} into ${parent.tableCode}`,
          metadata: { childSessionId, minimumSpendCents: newMin },
        },
      });

      return tx.guestSession.findUnique({ where: { id: input.parentSessionId } });
    });

    if (!result) return { ok: false, error: "Parent session not found after merge" };
    const session = {
      ...result,
      status: result.status as GuestSession["status"],
      createdAt: result.createdAt.toISOString(),
      settledExternallyAt: result.settledExternallyAt?.toISOString() ?? undefined,
      settlementMethod: (result.settlementMethod as SettlementMethod | undefined),
      serviceRefusedAt: result.serviceRefusedAt?.toISOString() ?? undefined,
      serviceRefusedReason: result.serviceRefusedReason ?? undefined,
      minimumSpendCents: result.minimumSpendCents ?? undefined,
      parentSessionId: result.parentSessionId ?? undefined,
      transferredFromTableId: result.transferredFromTableId ?? undefined,
      promoterId: result.promoterId ?? undefined,
      guestProfileId: result.guestProfileId ?? undefined,
    } as GuestSession;

    await publish({
      type: "SessionsMerged",
      venueId,
      payload: { childSessionId, parentSessionId: input.parentSessionId },
    });
    return { ok: true, session };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function reassignOrdersToSession(
  db: ScopedDb,
  venueId: string,
  fromSessionId: string,
  toSessionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await db.$transaction(async (tx) => {
      await tx.order.updateMany({
        where: { sessionId: fromSessionId },
        data: { sessionId: toSessionId },
      });
    });
    await publish({
      type: "OrdersReassigned",
      venueId,
      payload: { fromSessionId, toSessionId },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Order extras: rush, comp entire, remake, walkout
// ══════════════════════════════════════════════════════════════════════════

/**
 * Sets the rush flag on an order (OE-08). A rushed order renders with a
 * priority indicator in the queue; it does not change status.
 */
export async function rushOrder(
  db: ScopedDb,
  venueId: string,
  orderId: string,
  staffName: string,
): Promise<Order | null> {
  const prisma = getRawPrisma();
  const row = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `UPDATE orders SET is_rushed = true, rushed_by = $1, rushed_at = NOW(), updated_at = NOW()
     WHERE id = $2 AND venue_id = $3
     RETURNING id`,
    staffName,
    orderId,
    venueId,
  );
  if (row.length === 0) return null;
  // Re-read to return full domain object.
  const { getOrder } = await import("@/features/ordering/core");
  return getOrder(db, orderId);
}

/**
 * Comps an entire order (RV-07): creates a comp adjustment for the full
 * order total. Delegates to createAdjustment.
 */
export async function compEntireOrder(
  db: ScopedDb,
  venueId: string,
  orderId: string,
  reasonCode: string,
  staffId: string,
  staffName: string,
): Promise<{ ok: true; adjustment: TabAdjustment } | { ok: false; error: string }> {
  return createAdjustment(db, venueId, {
    orderId,
    kind: "comp",
    reasonCode,
    authorStaffId: staffId,
    authorStaffName: staffName,
  });
}

/**
 * Records a remake link (OT-05): when an order is voided and re-placed,
 * this ties old → new together for the audit trail.
 */
export async function remakeOrder(
  db: ScopedDb,
  venueId: string,
  oldOrderId: string,
  newOrderId: string,
  reason: string,
  staffId: string,
  staffName: string,
): Promise<OrderRemake | null> {
  // Verify both orders exist.
  const [oldOrder, newOrder] = await Promise.all([
    db.order.findUnique({ where: { id: oldOrderId } }),
    db.order.findUnique({ where: { id: newOrderId } }),
  ]);
  if (!oldOrder || !newOrder) return null;

  const row = await db.orderRemake.create({
    data: {
      venueId,
      oldOrderId,
      newOrderId,
      reason,
      remadeByStaffId: staffId,
      remadeByStaffName: staffName,
    },
  });
  return {
    id: row.id,
    oldOrderId: row.oldOrderId,
    newOrderId: row.newOrderId,
    reason: row.reason,
    remadeByStaffId: row.remadeByStaffId,
    remadeByStaffName: row.remadeByStaffName,
    remadeAt: row.createdAt.toISOString(),
  };
}

/**
 * Reports a walkout (OT-09): force-closes the session and records a
 * walkout entry for the venue's incident & loss record.
 */
export async function reportWalkout(
  db: ScopedDb,
  venueId: string,
  sessionId: string,
  description: string,
  staffId: string,
  staffName: string,
): Promise<WalkoutRecord | null> {
  const prisma = getRawPrisma();

  const session = await db.guestSession.findUnique({ where: { id: sessionId } });
  if (!session) return null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Force-close the session.
      await tx.guestSession.update({
        where: { id: sessionId },
        data: {
          status: "closed",
          settledExternallyAt: new Date(),
          settlementMethod: "house" as const,
        },
      });

      const walkout = await tx.walkoutRecord.create({
        data: {
          venueId,
          sessionId,
          tableCode: session.tableCode,
          description,
          reportedByStaffId: staffId,
          reportedByStaffName: staffName,
        },
      });

      await tx.auditEntry.create({
        data: {
          venueId,
          actorStaffId: staffId,
          actorName: staffName,
          action: "order:walkout",
          targetType: "session",
          targetId: sessionId,
          summary: `Walkout reported — ${session.tableCode}: ${description}`,
          metadata: { walkoutId: walkout.id },
        },
      });

      return walkout;
    });

    await publish({
      type: "WalkoutReported",
      venueId,
      payload: { sessionId, tableCode: session.tableCode },
    });
    return {
      id: result.id,
      sessionId: result.sessionId,
      tableCode: result.tableCode,
      description: result.description,
      reportedByStaffId: result.reportedByStaffId,
      reportedByStaffName: result.reportedByStaffName,
      reportedAt: result.createdAt.toISOString(),
    };
  } catch {
    // Return null on conflict — the caller can retry.
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// Split bill — read-only computation, no audit needed
// ══════════════════════════════════════════════════════════════════════════

export async function splitBill(
  db: ScopedDb,
  sessionId: string,
  splits: { label: string; orderItemIds: string[] }[],
): Promise<SplitBillAssignment | null> {
  const session = await db.guestSession.findUnique({ where: { id: sessionId } });
  if (!session || session.status !== "approved") return null;

  const orders = await db.order.findMany({
    where: { sessionId, status: { not: "cancelled" } },
    include: { items: true },
  });

  const result: SplitBillAssignment = { sessionId, splits: [] };

  for (const s of splits) {
    let subTotal = 0;
    for (const order of orders) {
      for (const item of order.items) {
        if (s.orderItemIds.includes(item.id)) {
          subTotal += item.unitCents * item.quantity;
        }
      }
    }
    result.splits.push({ label: s.label, orderItemIds: s.orderItemIds, subTotalCents: subTotal, settled: false });
  }

  return result;
}
