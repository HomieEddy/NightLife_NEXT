/**
 * Inventory ledger — the single owner of the invariant
 * `inventory === Σ movements.delta`.
 *
 * Every stock change runs through `applyMovement`: one row lock, one
 * inventory write, one movement row, one sold-out event. Callers own the
 * transaction and the business decision (how much, why); the ledger owns the
 * mechanics and the invariant. `transition` is the sibling compare-and-set
 * helper for status flips.
 */
import type { StockMovementType } from "@/lib/types";

/**
 * The transaction surface the ledger uses — deliberately minimal so it accepts
 * both the raw Prisma transaction client and the tenant-scoped extended client
 * from `db.$transaction` (their generics are otherwise mutually unassignable).
 */
export interface TxClient {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  menuItem: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stockMovement: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  soldOutEvent: any;
}

export interface ApplyMovementInput {
  venueId: string;
  menuItemId: string;
  /** Positive = stock in, negative = stock out. Ignored when `toInventory` is set. */
  delta: number;
  /** Set the count to an absolute value (stocktake/adjust): delta is derived from the locked read. */
  toInventory?: number;
  type: StockMovementType;
  note?: string;
  /** Throw when the item is not available (86'd). */
  requireAvailable?: boolean;
  /** Throw when inventory < requireStock ("not enough stock"). */
  requireStock?: number;
  /** Create a sold-out event when this movement zeroes the count. */
  emitSoldOut?: boolean;
  orderId?: string;
  unitCostCents?: number;
  purchaseOrderId?: string;
  stocktakeId?: string;
  wasteReason?: string;
}

export interface MovementResult {
  /** Null when the derived delta was zero — nothing was written. */
  movementId: string | null;
  before: number;
  after: number;
}

/**
 * Lock → check → move. The row lock (SELECT … FOR UPDATE) serializes
 * concurrent writers, so the read-compute-write below can never clobber a
 * racing movement: every mutation is derived from the locked snapshot.
 */
export async function applyMovement(
  tx: TxClient,
  input: ApplyMovementInput,
): Promise<MovementResult> {
  const {
    venueId,
    menuItemId,
    delta,
    toInventory,
    type,
    note,
    requireAvailable = false,
    requireStock,
    emitSoldOut = false,
    orderId,
    unitCostCents,
    purchaseOrderId,
    stocktakeId,
    wasteReason,
  } = input;

  const locked = await tx.$queryRawUnsafe<
    { id: string; name: string; inventory: number; is_available: boolean }[]
  >(
    `SELECT id, name, inventory, is_available FROM menu_items WHERE id = $1 AND venue_id = $2 FOR UPDATE`,
    menuItemId,
    venueId,
  );

  if (locked.length === 0) throw new Error(`Item ${menuItemId} not found`);
  const item = locked[0];

  if (requireAvailable && !item.is_available) {
    throw new Error(`${item.name} is not available`);
  }
  if (requireStock !== undefined && item.inventory < requireStock) {
    throw new Error(`Not enough stock for ${item.name} (have ${item.inventory}, need ${requireStock})`);
  }

  const resolvedDelta = toInventory !== undefined ? toInventory - item.inventory : delta;
  const newInventory = item.inventory + resolvedDelta;

  if (resolvedDelta === 0) {
    return { movementId: null, before: item.inventory, after: item.inventory };
  }

  await tx.menuItem.update({
    where: { id: menuItemId },
    data: { inventory: newInventory },
  });

  const movement = await tx.stockMovement.create({
    data: {
      venueId,
      menuItemId,
      itemName: item.name,
      type,
      delta: resolvedDelta,
      note,
      orderId,
      unitCostCents,
      purchaseOrderId,
      stocktakeId,
      wasteReason,
    },
  });

  if (emitSoldOut && item.inventory > 0 && newInventory === 0) {
    await tx.soldOutEvent.create({
      data: { venueId, itemId: menuItemId, itemName: item.name },
    });
  }

  return { movementId: movement.id, before: item.inventory, after: newInventory };
}

/** Status guard shape: a single status, a list, or an exclusion list. */
export type StatusGuard = string | string[] | { notIn: string[] };

/**
 * Compare-and-set on a model's status column — the one status flip every
 * state machine shares. Returns false when a concurrent writer already
 * moved the row (the caller re-reads and reports the actual state).
 */
export async function transition(
  tx: TxClient,
  model: "order" | "purchaseOrder" | "stocktake" | "barTab",
  id: string,
  opts: {
    from: StatusGuard;
    to: string;
    /** Extra fields to set alongside the status flip. */
    data?: Record<string, unknown>;
  },
): Promise<boolean> {
  const where =
    typeof opts.from === "string" || Array.isArray(opts.from)
      ? { status: { in: Array.isArray(opts.from) ? opts.from : [opts.from] } }
      : { status: { notIn: opts.from.notIn } };

  const client = tx as unknown as Record<
    string,
    { updateMany: (args: { where: unknown; data: unknown }) => Promise<{ count: number }> }
  >;

  const result = await client[model].updateMany({
    where: { id, ...where },
    data: { status: opts.to, ...opts.data },
  });
  return result.count > 0;
}
