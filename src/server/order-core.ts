/**
 * Order lifecycle: pricing transaction, state machine, claims, gifts.
 * The highest-risk module — every write path is transactional with
 * recordSale's row locks, and all money lives as integer cents.
 */
import type { getDb } from "../features/shared/db";
import { getRawPrisma } from "@/features/shared/db";
import { fromCents, toCents } from "../features/shared/money";
import { computeOrderPricing, type FeeInput, type PricingLineInput, type PromotionInput } from "./pricing";
import { publish } from "./events";
import { nextStatus, ORDER_FLOW } from "@/features/shared/order-status";
import type { ModifierGroup, Order, OrderStatus, ServiceFee } from "@/lib/types";
import type { z } from "zod";
import type { zSubmitOrder, zSendGift, zListOrders } from "./schemas/orders";

type ScopedDb = ReturnType<typeof getDb>;

export { nextStatus, ORDER_FLOW };

// ── Order status machine ──────────────────────────────────────────────

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
  acceptedAt: Date | null;
  claimedAt: Date | null;
  claimedByStaffId: string | null;
  claimedByStaffName: string | null;
  giftToTableId: string | null;
  giftToTableCode: string | null;
  giftNote: string | null;
  promotionId: string | null;
  promotionCode: string | null;
  promotionCents: number;
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
      modifiers: (i.modifiers as {
        groupId?: string;
        optionId?: string;
        kind?: "washer" | "presentation";
        groupName: string;
        optionName: string;
        deltaCents: number;
        quantity?: number;
      }[]).map((modifier) => ({
        groupId: modifier.groupId ?? modifier.groupName,
        optionId: modifier.optionId ?? modifier.optionName,
        kind: modifier.kind ?? "washer",
        groupName: modifier.groupName,
        optionName: modifier.optionName,
        priceDelta: fromCents(modifier.deltaCents),
        quantity: modifier.quantity ?? 1,
      })),
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
    acceptedAt: row.acceptedAt?.toISOString(),
    claimedAt: row.claimedAt?.toISOString(),
    claimedByStaffId: row.claimedByStaffId ?? undefined,
    claimedByStaffName: row.claimedByStaffName ?? undefined,
    giftToTableId: row.giftToTableId ?? undefined,
    giftToTableCode: row.giftToTableCode ?? undefined,
    giftNote: row.giftNote ?? undefined,
    promotionId: row.promotionId ?? undefined,
    promotionCode: row.promotionCode ?? undefined,
    promotionCents: row.promotionCents || undefined,
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

  // Load venue fees + happy-hour rules + menu items + optional promo for pricing
  const requestedIds = input.lines.map((line) => line.menuItemId);
  const [venueRow, happyHourRows, menuItems, packages] = await Promise.all([
    db.venue.findUnique({ where: { id: venueId } }),
    db.happyHourRule.findMany({ where: { isActive: true } }),
    db.menuItem.findMany({
      where: { id: { in: requestedIds } },
    }),
    db.bottlePackage.findMany({
      where: { id: { in: requestedIds }, isActive: true },
      include: { components: true },
    }),
  ]);

  if (!venueRow) return { ok: false, error: "Venue not found" };

  // Once a closure is requested the session takes no new orders — the cookie-derived
  // sessionId makes this the wall a manual URL or stale client can't route around.
  if (input.sessionId) {
    const guestSession = await db.guestSession.findUnique({ where: { id: input.sessionId } });
    if (guestSession?.status === "closure_requested") {
      return { ok: false, error: "Your tab is being closed — ordering is paused until the host settles it." };
    }
    if (guestSession?.status === "closed") {
      return { ok: false, error: "This tab is closed. Scan the table QR code to start a new session." };
    }
  }

  // Validate promo code before entering the transaction
  let promoRow: { id: string; code: string; type: string; value: number; appliesToCategoryIds: string[] } | null = null;
  if (input.promoCode) {
    const normalized = input.promoCode.trim().toUpperCase();
    const found = await db.promotion.findUnique({
      where: { venueId_code: { venueId, code: normalized } },
    });
    if (!found) return { ok: false, error: `Promo code "${input.promoCode}" not found` };
    const now = new Date();
    if (now < found.startsAt) return { ok: false, error: "This promo code is not yet active" };
    if (now > found.endsAt) return { ok: false, error: "This promo code has expired" };
    promoRow = found;
  }

  const itemMap = new Map(menuItems.map((i) => [i.id, i]));
  const packageMap = new Map(packages.map((entry) => [entry.id, entry]));
  const categories = await db.menuCategory.findMany({
    where: { id: { in: menuItems.map((item) => item.categoryId) } },
  });
  const categoryMap = new Map(categories.map((category) => [category.id, category]));

  type ResolvedModifier = {
    groupId: string;
    optionId: string;
    kind: "washer" | "presentation";
    groupName: string;
    optionName: string;
    deltaCents: number;
    quantity: number;
    inventoryItemId?: string;
  };
  type ResolvedLine = {
    menuItemId: string;
    name: string;
    priceCents: number;
    quantity: number;
    categoryId: string;
    packageId?: string;
    components: { menuItemId: string; quantity: number }[];
    modifiers: ResolvedModifier[];
    note?: string;
  };

  const resolvedLines: ResolvedLine[] = [];
  for (const line of input.lines) {
    const item = itemMap.get(line.menuItemId);
    const pkg = packageMap.get(line.menuItemId);
    if (!item && !pkg) return { ok: false, error: `Menu item ${line.menuItemId} not found` };
    if (item && !item.isAvailable) return { ok: false, error: `${item.name} is not available` };

    const groups = (item
      ? categoryMap.get(item.categoryId)?.modifierGroups
      : pkg?.modifierGroups) as unknown as ModifierGroup[] | undefined;
    const activeGroups = (groups ?? []).filter((group) => group.isActive);
    const selections = line.modifiers ?? [];
    const duplicate = selections.find((selection, index) =>
      selections.findIndex((entry) => entry.groupId === selection.groupId && entry.optionId === selection.optionId) !== index,
    );
    if (duplicate) return { ok: false, error: "Duplicate add-on selection" };

    const resolvedModifiers: ResolvedModifier[] = [];
    for (const group of activeGroups) {
      const groupSelections = selections.filter((selection) => selection.groupId === group.id);
      if (group.required && groupSelections.length === 0) {
        return { ok: false, error: `${group.name} is required` };
      }
      if (groupSelections.length > group.maxSelections) {
        return { ok: false, error: `${group.name} allows ${group.maxSelections} distinct choices` };
      }
      for (const selection of groupSelections) {
        const option = group.options.find((entry) => entry.id === selection.optionId && entry.isActive);
        if (!option) return { ok: false, error: "Unknown or inactive add-on option" };
        if (selection.quantity > option.maxQuantity) {
          return { ok: false, error: `${option.name} allows at most ${option.maxQuantity}` };
        }
        resolvedModifiers.push({
          groupId: group.id,
          optionId: option.id,
          kind: group.kind,
          groupName: group.name,
          optionName: option.name,
          deltaCents: toCents(option.priceDelta),
          quantity: selection.quantity,
          inventoryItemId: option.inventoryItemId,
        });
      }
    }
    if (selections.some((selection) => !activeGroups.some((group) => group.id === selection.groupId))) {
      return { ok: false, error: "Unknown or inactive add-on group" };
    }

    resolvedLines.push({
      menuItemId: line.menuItemId,
      name: item?.name ?? pkg!.name,
      priceCents: item?.priceCents ?? pkg!.priceCents,
      quantity: line.quantity,
      categoryId: item?.categoryId ?? "packages",
      packageId: pkg?.id,
      components: pkg
        ? pkg.components.map((component) => ({ menuItemId: component.itemId, quantity: component.quantity }))
        : [{ menuItemId: item!.id, quantity: 1 }],
      modifiers: resolvedModifiers,
      note: line.note,
    });
  }

  // Build pricing input
  const pricingLines: PricingLineInput[] = resolvedLines.map((line) => ({
      menuItemId: line.menuItemId,
      name: line.name,
      priceCents: line.priceCents,
      quantity: line.quantity,
      categoryId: line.categoryId,
      modifiers: line.modifiers.map((modifier) => ({
        groupName: modifier.groupName,
        optionName: modifier.optionName,
        deltaCents: modifier.deltaCents,
        quantity: modifier.quantity,
      })),
      packageId: line.packageId,
    }));

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

  const promotion: PromotionInput | undefined = promoRow
    ? {
        type: promoRow.type as "percentage" | "flat",
        value: promoRow.value,
        appliesToCategoryIds: promoRow.appliesToCategoryIds,
      }
    : undefined;

  const pricing = computeOrderPricing({
    lines: pricingLines,
    fees,
    happyHourRules,
    promotion,
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
          discountCents: pricing.discountCents + pricing.promotionCents,
          totalFeeCents: pricing.totalFeeCents,
          tipCents: pricing.tipCents,
          totalCents: pricing.totalCents,
          promotionId: promoRow?.id ?? null,
          promotionCode: promoRow?.code ?? null,
          promotionCents: pricing.promotionCents,
          status: "pending",
          items: {
            create: resolvedLines.map((line) => {
              return {
                menuItemId: line.menuItemId,
                name: line.name,
                quantity: line.quantity,
                unitCents: line.priceCents,
                modifiers: line.modifiers.map((modifier) => ({
                  groupId: modifier.groupId,
                  optionId: modifier.optionId,
                  kind: modifier.kind,
                  groupName: modifier.groupName,
                  optionName: modifier.optionName,
                  deltaCents: modifier.deltaCents,
                  quantity: modifier.quantity,
                })),
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

      // Base/package draw-down follows line quantity; add-on draw-down does not.
      const draws = new Map<string, number>();
      for (const line of resolvedLines) {
        for (const component of line.components) {
          draws.set(
            component.menuItemId,
            (draws.get(component.menuItemId) ?? 0) + component.quantity * line.quantity,
          );
        }
        for (const modifier of line.modifiers) {
          if (!modifier.inventoryItemId) continue;
          draws.set(
            modifier.inventoryItemId,
            (draws.get(modifier.inventoryItemId) ?? 0) + modifier.quantity,
          );
        }
      }

      for (const [menuItemId, quantity] of draws) {
        const locked = await tx.$queryRawUnsafe<{ id: string; name: string; inventory: number; is_available: boolean }[]>(
          `SELECT id, name, inventory, is_available FROM menu_items WHERE id = $1 AND venue_id = $2 FOR UPDATE`,
          menuItemId,
          venueId,
        );

        if (locked.length === 0) throw new Error(`Item ${menuItemId} not found`);
        const item = locked[0];
        if (!item.is_available) throw new Error(`${item.name} is not available`);
        if (item.inventory < quantity) {
          throw new Error(`Not enough stock for ${item.name} (have ${item.inventory}, need ${quantity})`);
        }

        const newInventory = item.inventory - quantity;
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
            delta: -quantity,
            note: `Order ${code}`,
          },
        });

        if (item.inventory > 0 && newInventory === 0) {
          await tx.soldOutEvent.create({
            data: { venueId, itemId: item.id, itemName: item.name },
          });
        }
      }

      // Increment promotion redemption count — exactly once per order, inside the transaction
      if (promoRow) {
        await tx.$executeRawUnsafe(
          `UPDATE promotions SET redemption_count = redemption_count + 1, updated_at = NOW() WHERE id = $1`,
          promoRow.id,
        );
      }

      return order;
    });

    const order = toOrder(orderRow);
    await publish({
      type: "OrderPlaced",
      venueId,
      payload: { orderId: order.id, tableId: order.tableId, sessionId: order.sessionId, code: order.code },
    });
    return { ok: true, order };
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
  opts?: { staffId?: string; staffName?: string },
): Promise<Order | null> {
  const row = await db.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
  if (!row) return null;

  const next = nextStatus(row.status as OrderStatus);
  if (!next) return toOrder(row);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = { status: next };

  // pending → accepted: stamp acceptedAt + auto-claim for the accepting staff
  if (next === "accepted") {
    data.acceptedAt = new Date();
    if (opts?.staffId && !row.claimedByStaffId) {
      data.claimedByStaffId = opts.staffId;
      data.claimedByStaffName = opts.staffName ?? null;
      data.claimedAt = data.acceptedAt;
    }
  }

  const updated = await db.order.update({
    where: { id: orderId },
    data,
    include: ORDER_INCLUDE,
  });
  const order = toOrder(updated);
  await publish({
    type: "OrderStatusChanged",
    venueId: order.venueId,
    payload: { orderId: order.id, status: next, sessionId: order.sessionId },
  });
  return order;
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

  const updated = await db.$transaction(async (tx) => {
    // Status guard inside the transaction so a concurrent cancel can't reverse stock twice.
    const transitioned = await tx.order.updateMany({
      where: { id: orderId, status: { notIn: TERMINAL_STATUSES } },
      data: { status: "cancelled" },
    });
    if (transitioned.count === 0) return null;

    // Reverse the exact sale movements recorded at placement — keeps inventory === Σ movements.
    const sales = await tx.stockMovement.findMany({
      where: { venueId: row.venueId, type: "sale", note: `Order ${row.code}` },
    });
    for (const movement of sales) {
      if (!movement.menuItemId) continue;
      await tx.$executeRawUnsafe(
        `UPDATE menu_items SET inventory = inventory + $1, updated_at = NOW() WHERE id = $2`,
        -movement.delta,
        movement.menuItemId,
      );
      await tx.stockMovement.create({
        data: {
          venueId: row.venueId,
          menuItemId: movement.menuItemId,
          itemName: movement.itemName,
          type: "adjustment",
          delta: -movement.delta,
          note: `Order ${row.code} cancelled`,
        },
      });
    }

    return tx.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
  });
  if (!updated) return toOrder(row);
  const order = toOrder(updated);
  await publish({
    type: "OrderStatusChanged",
    venueId: order.venueId,
    payload: { orderId: order.id, status: "cancelled", sessionId: order.sessionId },
  });
  return order;
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
      `UPDATE orders SET claimed_by_staff_id = $1, claimed_by_staff_name = $2, claimed_at = NOW(), updated_at = NOW()
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
    await publish({
      type: "OrderClaimed",
      venueId,
      payload: { orderId, staffId, staffName },
    });
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
  const order = toOrder(updated);
  await publish({
    type: "OrderReleased",
    venueId: order.venueId,
    payload: { orderId },
  });
  return order;
}
