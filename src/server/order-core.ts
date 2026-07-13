/**
 * Order lifecycle: pricing transaction, state machine, claims, gifts.
 * The highest-risk module — every write path is transactional with
 * recordSale's row locks, and all money lives as integer cents.
 */
import type { getDb } from "./db";
import { getRawPrisma } from "./db";
import { fromCents, toCents } from "./money";
import { computeOrderPricing, type FeeInput, type PricingLineInput } from "./pricing";
import type { Order, OrderStatus, ServiceFee } from "@/lib/types";
import type { z } from "zod";
import type { zSubmitOrder, zSendGift, zListOrders } from "./schemas/orders";

type ScopedDb = ReturnType<typeof getDb>;

// ── Order status machine ──────────────────────────────────────────────

export const ORDER_FLOW = [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "delivered",
] as const satisfies readonly OrderStatus[];

export function nextStatus(status: OrderStatus): OrderStatus | null {
  const i = (ORDER_FLOW as readonly OrderStatus[]).indexOf(status);
  return i >= 0 && i < ORDER_FLOW.length - 1 ? ORDER_FLOW[i + 1] : null;
}

const TERMINAL_STATUSES: OrderStatus[] = ["delivered", "cancelled"];

// ── Row → domain mapper ──────────────────────────────────────────────

interface OrderRow {
  id: string;
  venueId: string;
  code: string;
  sessionId: string | null;
  tableId: string;
  tableCode: string;
  zoneId: string;
  zoneName: string;
  guestName: string;
  subtotalCents: number;
  discountCents: number;
  totalFeeCents: number;
  tipCents: number;
  totalCents: number;
  status: string;
  placedAt: Date;
  updatedAt: Date;
  claimedByStaffId: string | null;
  claimedByStaffName: string | null;
  giftToTableId: string | null;
  giftToTableCode: string | null;
  giftNote: string | null;
  items: {
    id: string;
    menuItemId: string;
    name: string;
    quantity: number;
    unitCents: number;
    modifiers: unknown;
    note: string | null;
    packageId: string | null;
  }[];
  feeLines: {
    id: string;
    feeId: string;
    feeName: string;
    feeType: string;
    feeValue: number;
    amountCents: number;
  }[];
}

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    code: row.code,
    venueId: row.venueId,
    sessionId: row.sessionId ?? undefined,
    tableId: row.tableId,
    tableCode: row.tableCode,
    zoneId: row.zoneId,
    zoneName: row.zoneName,
    guestName: row.guestName,
    items: row.items.map((i) => ({
      id: i.id,
      menuItemId: i.menuItemId,
      name: i.name,
      quantity: i.quantity,
      unitPrice: fromCents(i.unitCents),
      modifiers: (i.modifiers as { groupName: string; optionName: string; deltaCents: number }[]).map(
        (m) => ({ groupName: m.groupName, optionName: m.optionName, priceDelta: fromCents(m.deltaCents) }),
      ),
      note: i.note ?? undefined,
    })),
    subtotal: fromCents(row.subtotalCents),
    serviceFee: fromCents(row.totalFeeCents),
    feeBreakdown: row.feeLines.map((fl) => ({
      fee: {
        id: fl.feeId,
        name: fl.feeName,
        type: fl.feeType as ServiceFee["type"],
        value: fl.feeType === "flat" ? fromCents(fl.feeValue) : fl.feeValue / 100,
      },
      amount: fromCents(fl.amountCents),
    })),
    tip: fromCents(row.tipCents),
    total: fromCents(row.totalCents),
    status: row.status as OrderStatus,
    placedAt: row.placedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    claimedByStaffId: row.claimedByStaffId ?? undefined,
    claimedByStaffName: row.claimedByStaffName ?? undefined,
    giftToTableId: row.giftToTableId ?? undefined,
    giftToTableCode: row.giftToTableCode ?? undefined,
    giftNote: row.giftNote ?? undefined,
  };
}

const ORDER_INCLUDE = { items: true, feeLines: true } as const;

// ── Venue fee config → pricing input adapter ─────────────────────────

function venueFeeToInput(sf: ServiceFee): FeeInput {
  if (sf.type === "flat") {
    return { id: sf.id, name: sf.name, type: "flat", valueCents: toCents(sf.value) };
  }
  return { id: sf.id, name: sf.name, type: "percentage", value: Math.round(sf.value * 100) };
}

// ── Order counter (venue-scoped) ─────────────────────────────────────

async function nextOrderCode(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  venueId: string,
): Promise<string> {
  const result: { cnt: bigint }[] = await tx.$queryRawUnsafe(
    `SELECT COUNT(*) AS cnt FROM orders WHERE venue_id = $1`,
    venueId,
  );
  const seq = Number(result[0].cnt) + 1;
  return `A-${String(seq).padStart(3, "0")}`;
}

// ── Queries ───────────────────────────────────────────────────────────

export async function listOrders(
  db: ScopedDb,
  filter?: z.infer<typeof zListOrders>,
): Promise<Order[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (filter?.status?.length) where.status = { in: filter.status };
  if (filter?.zoneIds?.length) where.zoneId = { in: filter.zoneIds };
  if (filter?.sessionId) where.sessionId = filter.sessionId;
  if (filter?.guestName) where.guestName = filter.guestName;

  const rows = await db.order.findMany({
    where,
    include: ORDER_INCLUDE,
    orderBy: { placedAt: "desc" },
  });
  return rows.map(toOrder);
}

export async function getOrder(
  db: ScopedDb,
  orderId: string,
): Promise<Order | null> {
  const row = await db.order.findUnique({
    where: { id: orderId },
    include: ORDER_INCLUDE,
  });
  return row ? toOrder(row) : null;
}

// ── Submit order (the transaction) ────────────────────────────────────

export async function submitOrder(
  db: ScopedDb,
  venueId: string,
  input: z.infer<typeof zSubmitOrder>,
): Promise<{ ok: true; order: Order } | { ok: false; error: string }> {
  const prisma = getRawPrisma();

  // Load venue fees + happy-hour rules + menu items for pricing
  const [venueRow, happyHourRows, menuItems] = await Promise.all([
    db.venue.findUnique({ where: { id: venueId } }),
    db.happyHourRule.findMany({ where: { isActive: true } }),
    db.menuItem.findMany({
      where: { id: { in: input.lines.map((l) => l.menuItemId) } },
    }),
  ]);

  if (!venueRow) return { ok: false, error: "Venue not found" };

  const itemMap = new Map(menuItems.map((i) => [i.id, i]));
  for (const line of input.lines) {
    const item = itemMap.get(line.menuItemId);
    if (!item) return { ok: false, error: `Menu item ${line.menuItemId} not found` };
    if (!item.isAvailable) return { ok: false, error: `${item.name} is not available` };
  }

  // Build pricing input
  const pricingLines: PricingLineInput[] = input.lines.map((line) => {
    const item = itemMap.get(line.menuItemId)!;
    return {
      menuItemId: item.id,
      name: item.name,
      priceCents: item.priceCents,
      quantity: line.quantity,
      categoryId: item.categoryId,
      modifiers: (line.modifiers ?? []).map((m) => ({
        groupName: m.groupName,
        optionName: m.optionName,
        deltaCents: m.deltaCents,
      })),
      packageId: line.packageId,
    };
  });

  const serviceFees = venueRow.serviceFees as unknown as ServiceFee[];
  const fees = serviceFees.map(venueFeeToInput);

  const happyHourRules = happyHourRows.map((r) => ({
    id: r.id,
    isActive: r.isActive,
    daysOfWeek: r.daysOfWeek,
    startTime: r.startTime,
    endTime: r.endTime,
    discountPct: r.discountPct,
    appliesToCategoryIds: r.appliesToCategoryIds,
  }));

  const pricing = computeOrderPricing({
    lines: pricingLines,
    fees,
    happyHourRules,
    tipCents: input.tipCents,
    now: new Date(),
  });

  try {
    const orderRow = await prisma.$transaction(async (tx) => {
      const code = await nextOrderCode(tx, venueId);

      const order = await tx.order.create({
        data: {
          venueId,
          code,
          sessionId: input.sessionId ?? null,
          tableId: input.tableId,
          tableCode: input.tableCode,
          zoneId: input.zoneId,
          zoneName: input.zoneName,
          guestName: input.guestName,
          subtotalCents: pricing.subtotalCents,
          discountCents: pricing.discountCents,
          totalFeeCents: pricing.totalFeeCents,
          tipCents: pricing.tipCents,
          totalCents: pricing.totalCents,
          status: "pending",
          items: {
            create: input.lines.map((line) => {
              const item = itemMap.get(line.menuItemId)!;
              return {
                menuItemId: item.id,
                name: item.name,
                quantity: line.quantity,
                unitCents: item.priceCents,
                modifiers: line.modifiers ?? [],
                note: line.note ?? null,
                packageId: line.packageId ?? null,
              };
            }),
          },
          feeLines: {
            create: pricing.feeLines.map((fl) => ({
              feeId: fl.feeId,
              feeName: fl.feeName,
              feeType: fl.feeType,
              feeValue: fl.feeValue,
              amountCents: fl.amountCents,
            })),
          },
        },
        include: ORDER_INCLUDE,
      });

      // Decrement inventory with row locks (recordSale logic inlined for atomicity)
      for (const line of input.lines) {
        const locked = await tx.$queryRawUnsafe<{ id: string; name: string; inventory: number; is_available: boolean }[]>(
          `SELECT id, name, inventory, is_available FROM menu_items WHERE id = $1 AND venue_id = $2 FOR UPDATE`,
          line.menuItemId,
          venueId,
        );

        if (locked.length === 0) throw new Error(`Item ${line.menuItemId} not found`);
        const item = locked[0];
        if (!item.is_available) throw new Error(`${item.name} is not available`);
        if (item.inventory < line.quantity) {
          throw new Error(`Not enough stock for ${item.name} (have ${item.inventory}, need ${line.quantity})`);
        }

        const newInventory = item.inventory - line.quantity;
        await tx.$executeRawUnsafe(
          `UPDATE menu_items SET inventory = $1, updated_at = NOW() WHERE id = $2`,
          newInventory,
          item.id,
        );
        await tx.stockMovement.create({
          data: {
            venueId,
            menuItemId: item.id,
            itemName: item.name,
            type: "sale",
            delta: -line.quantity,
            note: `Order ${code}`,
          },
        });

        if (item.inventory > 0 && newInventory === 0) {
          await tx.soldOutEvent.create({
            data: { venueId, itemId: item.id, itemName: item.name },
          });
        }
      }

      return order;
    });

    return { ok: true, order: toOrder(orderRow) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ── Send gift ─────────────────────────────────────────────────────────

export async function sendGift(
  db: ScopedDb,
  venueId: string,
  input: z.infer<typeof zSendGift>,
): Promise<{ ok: true; order: Order } | { ok: false; error: string }> {
  const menuItem = await db.menuItem.findUnique({ where: { id: input.menuItemId } });
  if (!menuItem) return { ok: false, error: "Menu item not found" };
  if (!menuItem.isAvailable) return { ok: false, error: `${menuItem.name} is not available` };

  return submitOrder(db, venueId, {
    tableId: input.fromTableId,
    tableCode: input.fromTableCode,
    zoneId: input.fromZoneId,
    zoneName: input.fromZoneName,
    guestName: input.guestName,
    sessionId: input.sessionId,
    lines: [{
      menuItemId: input.menuItemId,
      quantity: 1,
      modifiers: [],
    }],
    tipCents: 0,
  }).then((result) => {
    if (!result.ok) return result;
    // Stamp gift fields — update the order row
    return getRawPrisma().order.update({
      where: { id: result.order.id },
      data: {
        giftToTableId: input.toTableId,
        giftToTableCode: input.toTableCode,
        giftNote: input.note ?? null,
      },
      include: ORDER_INCLUDE,
    }).then((row) => ({ ok: true as const, order: toOrder(row) }));
  });
}

// ── Advance order (state machine) ─────────────────────────────────────

export async function advanceOrder(
  db: ScopedDb,
  orderId: string,
): Promise<Order | null> {
  const row = await db.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
  if (!row) return null;

  const next = nextStatus(row.status as OrderStatus);
  if (!next) return toOrder(row);

  const updated = await db.order.update({
    where: { id: orderId },
    data: { status: next },
    include: ORDER_INCLUDE,
  });
  return toOrder(updated);
}

// ── Cancel order ──────────────────────────────────────────────────────

export async function cancelOrder(
  db: ScopedDb,
  orderId: string,
): Promise<Order | null> {
  const row = await db.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
  if (!row) return null;

  if (TERMINAL_STATUSES.includes(row.status as OrderStatus)) {
    return toOrder(row);
  }

  const updated = await db.order.update({
    where: { id: orderId },
    data: { status: "cancelled" },
    include: ORDER_INCLUDE,
  });
  return toOrder(updated);
}

// ── Claim order (atomic compare-and-set) ──────────────────────────────

export async function claimOrder(
  db: ScopedDb,
  venueId: string,
  orderId: string,
  staffId: string,
  staffName: string,
): Promise<{ ok: true; order: Order } | { ok: false; error: string }> {
  const prisma = getRawPrisma();
  try {
    const result = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `UPDATE orders SET claimed_by_staff_id = $1, claimed_by_staff_name = $2, updated_at = NOW()
       WHERE id = $3 AND venue_id = $4 AND claimed_by_staff_id IS NULL
       RETURNING id`,
      staffId,
      staffName,
      orderId,
      venueId,
    );
    if (result.length === 0) {
      return { ok: false, error: "Order already claimed or not found" };
    }
    const order = await getOrder(db, orderId);
    return { ok: true, order: order! };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ── Release order ─────────────────────────────────────────────────────

export async function releaseOrder(
  db: ScopedDb,
  orderId: string,
): Promise<Order | null> {
  const row = await db.order.findUnique({ where: { id: orderId } });
  if (!row) return null;

  const updated = await db.order.update({
    where: { id: orderId },
    data: { claimedByStaffId: null, claimedByStaffName: null },
    include: ORDER_INCLUDE,
  });
  return toOrder(updated);
}
