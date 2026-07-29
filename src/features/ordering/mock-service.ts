/**
 * mockOrdersService — future backend boundary for order lifecycle.
 * The permanent demo counterpart to transactional live orders and SSE updates.
 */
import type {
  AdjustmentReason,
  CartLine,
  GuestSession,
  MenuItem,
  Order,
  OrderRemake,
  OrderStatus,
  TabAdjustment,
  TabAdjustmentKind,
  WalkoutRecord,
} from "@/lib/types";
import { mockOrders, mockGuestSessions } from "@/features/ordering/mock-data";
import { mockMenuItems } from "@/features/menu/mock-data";
import { mockVenue } from "@/features/venue/mock-data";
import { mockAdjustmentReasons } from "@/features/sessions/tab-mock-data";
import { computeFeeLines, computeServiceFee } from "@/features/ordering/fees";
import { cartHappyHourDiscount } from "@/lib/happy-hour";
import { orderLineSubtotal } from "@/lib/order-line";
import { nextStatus, ORDER_FLOW } from "@/features/shared/order-status";
import {
  isAdjustmentAmountValid,
  orderItemAmountCents,
  orderItemPartialAmountCents,
  orderTotalCents,
} from "@/lib/tab";
import { mockGuestsService } from "@/features/guests/mock-service";
import { mockMenuService, restoreSale } from "@/features/menu/mock-service";
import { mockVenueService } from "@/features/venue/mock-service";
import { mockPulseService } from "@/features/realtime/pulse-mock-service";
import { mockAuditService } from "@/features/platform/audit-mock-service";
import { clone, delay, uid } from "@/features/shared/delay";

export { nextStatus, ORDER_FLOW };

// Module-level in-memory store: mutations persist across pages within a session,
// simulating shared state between guest and staff surfaces.
let orders: Order[] = clone(mockOrders);
let orderCounter = 39;
let walkoutRecords: WalkoutRecord[] = [];

// ---------- Tab ledger: adjustments (plan 16) ----------
// Append-only — corrections are new rows (a reversal), never edits (INV-I1 rule).
let adjustments: TabAdjustment[] = [];
let adjustmentReasons: AdjustmentReason[] = clone(mockAdjustmentReasons);
let remakes: OrderRemake[] = [];

function targetKey(orderId: string, orderItemId?: string) {
  return orderItemId ? `${orderId}:${orderItemId}` : orderId;
}

/** Existing (non-reversed-away) adjustments against the same order or order-item target. */
function adjustmentsForTarget(orderId: string, orderItemId?: string): TabAdjustment[] {
  return adjustments.filter((a) => targetKey(a.orderId ?? "", a.orderItemId) === targetKey(orderId, orderItemId));
}

/** Once a tab closure is requested the session takes no new orders — UI gates are advisory, this is the wall. */
async function assertSessionOrderable(sessionId: string | undefined): Promise<void> {
  if (!sessionId) return;
  const session = await mockGuestsService.getSession(sessionId);
  if (!session) return;
  if (session.status === "closure-requested") {
    throw new Error("Your tab is being closed — ordering is paused until the host settles it.");
  }
  if (session.status === "closed") {
    throw new Error("This tab is closed. Scan the table QR code to start a new session.");
  }
  if (session.serviceRefusedAt) {
    throw new Error("Service has been paused for this table. Please speak with a host.");
  }
  // OT-06: last-call enforcement at the service boundary
  const lastCallState = await mockPulseService.getLastCallState();
  if (lastCallState.active) {
    const venue = await mockVenueService.getVenueSnapshot();
    const policy = venue.lastCallPolicy ?? "block-all";
    if (policy === "block-all") {
      throw new Error("Last call — no new orders are being accepted.");
    }
    if (policy === "allow-last-round" && session.lastCallOrderPlaced) {
      throw new Error("Last call — your final round has already been placed.");
    }
  }
}

export const mockOrdersService = {
  async listOrders(filter?: { status?: OrderStatus[]; zoneIds?: string[] }): Promise<Order[]> {
    await delay();
    let result = clone(orders);
    if (filter?.status?.length) result = result.filter((o) => filter.status!.includes(o.status));
    if (filter?.zoneIds?.length) result = result.filter((o) => filter.zoneIds!.includes(o.zoneId));
    return result.sort((a, b) => b.placedAt.localeCompare(a.placedAt));
  },

  async getOrder(orderId: string): Promise<Order | null> {
    await delay(200);
    return clone(orders.find((o) => o.id === orderId) ?? null);
  },

  async listGuestOrders(guestName: string): Promise<Order[]> {
    await delay();
    return clone(orders.filter((o) => o.guestName === guestName)).sort((a, b) =>
      b.placedAt.localeCompare(a.placedAt),
    );
  },

  async submitOrder(input: {
    tableId: string;
    tableCode: string;
    zoneId: string;
    zoneName: string;
    guestName: string;
    sessionId?: string;
    lines: CartLine[];
    tip: number;
    promoCode?: string;
    promoDiscount?: number;
    promoId?: string;
  }): Promise<Order> {
    await delay(700);
    await assertSessionOrderable(input.sessionId);
    const subtotal = input.lines.reduce(
      (sum, line) =>
        sum + orderLineSubtotal(line.menuItem.price, line.quantity, line.modifiers),
      0,
    );
    // Live settings, so fee edits in /manager/settings apply to new orders.
    const venue = await mockVenueService.getVenueSnapshot();

    // Happy hour discounts covered category lines — same rule selection as the
    // live pricing engine (src/server/pricing.ts), applied here in dollars.
    const happyHourRules = await mockMenuService.listHappyHourRules();
    const placedAt = new Date();
    const { discount: happyHourDiscount, ruleId: happyHourRuleId } = cartHappyHourDiscount(
      happyHourRules,
      input.lines.map((line) => ({
        unitPrice: line.menuItem.price,
        quantity: line.quantity,
        categoryId: line.menuItem.categoryId,
        addOns: line.modifiers,
      })),
      placedAt,
    );

    // Promotions stack after happy hour, mirroring the live engine's order.
    const afterDiscounts = subtotal - happyHourDiscount - (input.promoDiscount ?? 0);
    const feeBreakdown = computeFeeLines(afterDiscounts, venue);
    const serviceFee = computeServiceFee(afterDiscounts, venue);
    const now = placedAt.toISOString();
    const order: Order = {
      id: uid("ord"),
      code: `A-${String(orderCounter++).padStart(3, "0")}`,
      venueId: mockVenue.id,
      sessionId: input.sessionId,
      tableId: input.tableId,
      tableCode: input.tableCode,
      zoneId: input.zoneId,
      zoneName: input.zoneName,
      guestName: input.guestName,
      items: input.lines.map((line) => ({
        id: uid("oi"),
        menuItemId: line.menuItem.id,
        name: line.menuItem.name,
        quantity: line.quantity,
        unitPrice: line.menuItem.price,
        modifiers: line.modifiers,
        note: line.note,
      })),
      subtotal,
      serviceFee,
      feeBreakdown,
      tip: input.tip,
      total: Math.round((afterDiscounts + serviceFee + input.tip) * 100) / 100,
      promotionId: input.promoId,
      promotionCode: input.promoCode,
      promotionCents: input.promoDiscount ? Math.round(input.promoDiscount * 100) : undefined,
      happyHourRuleId: happyHourDiscount > 0 ? happyHourRuleId : undefined,
      happyHourCents: happyHourDiscount > 0 ? Math.round(happyHourDiscount * 100) : undefined,
      status: "pending",
      placedAt: now,
      updatedAt: now,
    };
    orders = [order, ...orders];
    // Business logic: selling bottles (or packages) draws down tonight's inventory.
    const [categories, packages] = await Promise.all([
      mockMenuService.listCategories(true),
      mockMenuService.listPackages(true),
    ]);
    const washerLines = input.lines.flatMap((line) => {
      const groups = packages.find((pkg) => pkg.id === line.menuItem.id)?.modifierGroups
        ?? categories.find((category) => category.id === line.menuItem.categoryId)?.modifierGroups
        ?? [];
      return line.modifiers.flatMap((modifier) => {
        const option = groups
          .find((group) => group.id === modifier.groupId)
          ?.options.find((candidate) => candidate.id === modifier.optionId);
        return option?.inventoryItemId
          ? [{ menuItemId: option.inventoryItemId, quantity: modifier.quantity }]
          : [];
      });
    });
    await mockMenuService.recordSale(
      [
        ...order.items.map((item) => ({ menuItemId: item.menuItemId, quantity: item.quantity })),
        ...washerLines,
      ],
    );
    // OT-06: stamp session so allow-last-round blocks the next order
    if (input.sessionId) {
      const lastCallState = await mockPulseService.getLastCallState();
      if (lastCallState.active) {
        await mockGuestsService.markLastCallOrderPlaced(input.sessionId);
      }
    }
    return clone(order);
  },

  /**
   * "Send a bottle": billed to the sender's own table/tab, but flagged for
   * delivery to a different table. Staff see the delivery target on the card.
   */
  async sendGift(input: {
    fromTableId: string;
    fromTableCode: string;
    fromZoneId: string;
    fromZoneName: string;
    guestName: string;
    sessionId?: string;
    items: { menuItem: MenuItem; quantity: number }[];
    toTableId: string;
    toTableCode: string;
    note?: string;
  }): Promise<Order> {
    await delay(700);
    await assertSessionOrderable(input.sessionId);
    const orderItems = input.items.map((line) => ({
      id: uid("oi"),
      menuItemId: line.menuItem.id,
      name: line.menuItem.name,
      quantity: line.quantity,
      unitPrice: line.menuItem.price,
      modifiers: [] as Order["items"][number]["modifiers"],
    }));
    const subtotal = orderItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const venue = await mockVenueService.getVenueSnapshot();
    const feeBreakdown = computeFeeLines(subtotal, venue);
    const serviceFee = computeServiceFee(subtotal, venue);
    const now = new Date().toISOString();
    const order: Order = {
      id: uid("ord"),
      code: `A-${String(orderCounter++).padStart(3, "0")}`,
      venueId: mockVenue.id,
      sessionId: input.sessionId,
      tableId: input.fromTableId,
      tableCode: input.fromTableCode,
      zoneId: input.fromZoneId,
      zoneName: input.fromZoneName,
      guestName: input.guestName,
      items: orderItems,
      subtotal,
      serviceFee,
      feeBreakdown,
      tip: 0,
      total: Math.round((subtotal + serviceFee) * 100) / 100,
      status: "pending",
      placedAt: now,
      updatedAt: now,
      giftToTableId: input.toTableId,
      giftToTableCode: input.toTableCode,
      giftNote: input.note,
    };
    orders = [order, ...orders];
    await mockMenuService.recordSale(
      input.items.map((line) => ({ menuItemId: line.menuItem.id, quantity: line.quantity })),
    );
    return clone(order);
  },

  async listOrdersBySession(sessionId: string): Promise<Order[]> {
    await delay();
    return clone(orders.filter((o) => o.sessionId === sessionId));
  },

  /**
   * Session merge's order-side: re-points every order from the absorbed
   * (child) session to the parent — one ledger, no new orders created. Call
   * alongside guestsService.mergeSession(), which owns the session-side.
   */
  async reassignOrdersToSession(fromSessionId: string, toSessionId: string): Promise<void> {
    await delay(200);
    for (const order of orders) {
      if (order.sessionId === fromSessionId) order.sessionId = toSessionId;
    }
  },

  async advanceOrder(orderId: string): Promise<Order | null> {
    await delay(300);
    const order = orders.find((o) => o.id === orderId);
    if (!order) return null;
    const next = nextStatus(order.status);
    if (!next) return clone(order);
    order.status = next;
    order.updatedAt = new Date().toISOString();
    if (next === "accepted") {
      order.acceptedAt = order.updatedAt;
    }
    return clone(order);
  },

  /** Fails (returns null) if another staff member already claimed it or the order is done. */
  async claimOrder(orderId: string, staffId: string, staffName: string): Promise<Order | null> {
    await delay(300);
    const order = orders.find((o) => o.id === orderId);
    if (!order || order.claimedByStaffId || order.status === "delivered" || order.status === "cancelled") return null;
    order.claimedByStaffId = staffId;
    order.claimedByStaffName = staffName;
    return clone(order);
  },

  async releaseOrder(orderId: string): Promise<Order | null> {
    await delay(250);
    const order = orders.find((o) => o.id === orderId);
    if (!order) return null;
    order.claimedByStaffId = undefined;
    order.claimedByStaffName = undefined;
    return clone(order);
  },

  /** Fails (returns null) once delivered — the bottles are on the table; use an adjustment instead. */
  async cancelOrder(orderId: string): Promise<Order | null> {
    await delay(300);
    const order = orders.find((o) => o.id === orderId);
    if (!order || order.status === "delivered" || order.status === "cancelled") return null;
    order.status = "cancelled";
    order.updatedAt = new Date().toISOString();
    // Return the placement draw-down (bottles + linked washers) to stock.
    const [categories, packages] = await Promise.all([
      mockMenuService.listCategories(true),
      mockMenuService.listPackages(true),
    ]);
    const groups = [
      ...categories.flatMap((category) => category.modifierGroups ?? []),
      ...packages.flatMap((pkg) => pkg.modifierGroups ?? []),
    ];
    const washerLines = order.items.flatMap((item) =>
      item.modifiers.flatMap((modifier) => {
        const option = groups
          .find((group) => group.id === modifier.groupId)
          ?.options.find((candidate) => candidate.id === modifier.optionId);
        return option?.inventoryItemId
          ? [{ menuItemId: option.inventoryItemId, quantity: modifier.quantity }]
          : [];
      }),
    );
    await restoreSale(
      [
        ...order.items.map((item) => ({ menuItemId: item.menuItemId, quantity: item.quantity })),
        ...washerLines,
      ],
      `Order ${order.code} cancelled`,
    );
    return clone(order);
  },

  // ---------- Tab ledger: adjustments (plan 16) ----------

  async listAdjustmentReasons(kind?: TabAdjustmentKind): Promise<AdjustmentReason[]> {
    await delay(100);
    const result = kind ? adjustmentReasons.filter((r) => r.kind === kind) : adjustmentReasons;
    return clone(result.filter((r) => r.isActive));
  },

  /** All configured reasons, including inactive ones — for the settings editor. */
  async listAllAdjustmentReasons(): Promise<AdjustmentReason[]> {
    await delay(100);
    return clone(adjustmentReasons);
  },

  async createAdjustmentReason(input: Omit<AdjustmentReason, "id" | "venueId">): Promise<AdjustmentReason> {
    await delay(300);
    const reason: AdjustmentReason = { id: uid("ar"), venueId: mockVenue.id, ...input };
    adjustmentReasons = [...adjustmentReasons, reason];
    return clone(reason);
  },

  async setAdjustmentReasonActive(reasonId: string, isActive: boolean): Promise<AdjustmentReason | null> {
    await delay(200);
    const reason = adjustmentReasons.find((r) => r.id === reasonId);
    if (!reason) return null;
    reason.isActive = isActive;
    return clone(reason);
  },

  async listAdjustments(sessionId: string): Promise<TabAdjustment[]> {
    await delay();
    return clone(adjustments.filter((a) => a.sessionId === sessionId)).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  },

  /** Venue-wide — for Pulse's table-under-minimum check and cash-out/analytics rollups. */
  async listAllAdjustments(): Promise<TabAdjustment[]> {
    await delay();
    return clone(adjustments).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  /**
   * The one entry point for void / comp / discount. Scope is the whole order
   * (no orderItemId), one line (orderItemId, no quantity) or a partial
   * quantity of one line (orderItemId + quantity). Void additionally returns
   * the affected units to inventory in the same call — comp and discount
   * leave inventory untouched (the product left the building). Every call
   * writes one AuditEntry alongside the ledger row (same step, not after).
   */
  async adjustOrder(input: {
    orderId: string;
    orderItemId?: string;
    quantity?: number;
    kind: TabAdjustmentKind;
    reasonCode: string;
    note?: string;
    authorStaffId: string;
    authorStaffName: string;
  }): Promise<TabAdjustment> {
    await delay(400);
    const order = orders.find((o) => o.id === input.orderId);
    if (!order) throw new Error("Order not found");
    if (!order.sessionId) throw new Error("This order has no session to adjust a tab for");

    const item = input.orderItemId ? order.items.find((i) => i.id === input.orderItemId) : undefined;
    if (input.orderItemId && !item) throw new Error("Order item not found");

    const targetFullCents = item
      ? orderItemAmountCents(item)
      : orderTotalCents(order);
    const amountCents =
      item && input.quantity != null
        ? orderItemPartialAmountCents(item, input.quantity)
        : targetFullCents;

    const prior = adjustmentsForTarget(input.orderId, input.orderItemId);
    if (!isAdjustmentAmountValid(amountCents, targetFullCents, prior)) {
      throw new Error("This would adjust more than remains on that line — check for a prior adjustment.");
    }

    const adjustment: TabAdjustment = {
      id: uid("adj"),
      venueId: mockVenue.id,
      sessionId: order.sessionId,
      orderId: order.id,
      orderItemId: input.orderItemId,
      kind: input.kind,
      amountCents,
      quantity: input.quantity,
      reasonCode: input.reasonCode,
      note: input.note,
      authorStaffId: input.authorStaffId,
      authorStaffName: input.authorStaffName,
      createdAt: new Date().toISOString(),
    };
    adjustments = [adjustment, ...adjustments];

    const label = item
      ? `${input.quantity ?? item.quantity}× ${item.name}`
      : `order ${order.code}`;
    await mockAuditService.record({
      actorStaffId: input.authorStaffId,
      actorName: input.authorStaffName,
      action: `tab:${input.kind}`,
      targetType: "order",
      targetId: order.id,
      summary: `${input.kind[0].toUpperCase()}${input.kind.slice(1)}ed ${label} — ${input.reasonCode}`,
      metadata: { sessionId: order.sessionId, amountCents, reasonCode: input.reasonCode, note: input.note },
    });

    // Void = it never happened — return the void'd units to inventory.
    // Comp/discount = it happened, inventory stays as-is (product left the building).
    if (input.kind === "void") {
      const voidQty = item ? (input.quantity ?? item.quantity) : undefined;
      const lines = item
        ? [{ menuItemId: item.menuItemId, quantity: voidQty! }]
        : order.items.map((oi) => ({ menuItemId: oi.menuItemId, quantity: oi.quantity }));
      await restoreSale(lines, `Void — ${input.reasonCode}`, adjustment.id);
    }

    return clone(adjustment);
  },

  /** Records a reversal row and marks the original superseded — never edited or deleted (INV-I1). */
  async reverseAdjustment(adjustmentId: string, staffId: string, staffName: string): Promise<TabAdjustment | null> {
    await delay(300);
    const original = adjustments.find((a) => a.id === adjustmentId);
    if (!original || original.reversedByAdjustmentId) return null;
    const reversal: TabAdjustment = {
      id: uid("adj"),
      venueId: mockVenue.id,
      sessionId: original.sessionId,
      orderId: original.orderId,
      orderItemId: original.orderItemId,
      kind: original.kind,
      amountCents: 0,
      reasonCode: original.reasonCode,
      note: `Reversal of ${original.id}`,
      authorStaffId: staffId,
      authorStaffName: staffName,
      createdAt: new Date().toISOString(),
    };
    adjustments = [reversal, ...adjustments];
    original.reversedByAdjustmentId = reversal.id;
    await mockAuditService.record({
      actorStaffId: staffId,
      actorName: staffName,
      action: "tab:reverse-adjustment",
      targetType: "adjustment",
      targetId: original.id,
      summary: `Reversed a ${original.kind} adjustment on order ${original.orderId}`,
      metadata: { sessionId: original.sessionId },
    });
    return clone(original);
  },

  /** OE-08: Reopen a recently closed session within the configured window. */
  async reopenSession(sessionId: string): Promise<GuestSession | null> {
    await delay(300);
    const session = mockGuestSessions.find((s) => s.id === sessionId);
    if (!session || session.status !== "closed") throw new Error("Session is not closed.");
    const age = (Date.now() - new Date(session.settledExternallyAt ?? session.createdAt).getTime()) / 60000;
    if (age > 30) throw new Error("Reopen window expired (>30 min since close).");
    session.status = "approved";
    session.settledExternallyAt = undefined;
    session.settlementMethod = undefined;
    return clone(session);
  },

  /** OE-06: Count delivered alcoholic orders for this session's round tracking. */
  async getSessionRoundCount(sessionId: string): Promise<number> {
    await delay(100);
    return orders.filter((o) => o.sessionId === sessionId && o.status === "delivered")
      .reduce((sum, o) => {
        const isAlcoholic = o.items.some((item) => mockMenuItems.find((i) => i.id === item.menuItemId)?.isAlcoholic);
        return sum + (isAlcoholic ? 1 : 0);
      }, 0);
  },

  /** OE-07: Detect if two sessions are active on the same table (dual phone). */
  async detectDualSession(tableId: string): Promise<GuestSession[]> {
    await delay(100);
    return clone(mockGuestSessions.filter((s) => s.tableId === tableId && s.status === "approved"));
  },

  /** OT-09: Report a walkout — force-closes session and creates a walkout record. */
  async reportWalkout(sessionId: string, description: string, staffId: string, staffName: string): Promise<WalkoutRecord> {
    await delay(400);
    await mockGuestsService.forceCloseSession(sessionId, `Walkout: ${description}`, staffId, staffName);
    const session = await mockGuestsService.getSession(sessionId);
    const record: WalkoutRecord = {
      id: uid("wo"),
      sessionId,
      tableCode: session?.tableCode ?? "unknown",
      description,
      reportedByStaffId: staffId,
      reportedByStaffName: staffName,
      reportedAt: new Date().toISOString(),
    };
    walkoutRecords = [...walkoutRecords, record];
    return clone(record);
  },

  /** RV-06: Pre-order inventory availability check — returns items that would go out of stock. */
  async checkInventoryAvailability(cartLines: { menuItemId: string; quantity: number }[]): Promise<{ menuItemId: string; name: string; available: number; requested: number }[]> {
    await delay(100);
    const warnings: { menuItemId: string; name: string; available: number; requested: number }[] = [];
    for (const line of cartLines) {
      const item = mockMenuItems.find((i) => i.id === line.menuItemId);
      if (item && item.inventory < line.quantity) {
        warnings.push({ menuItemId: item.id, name: item.name, available: item.inventory, requested: line.quantity });
      }
    }
    return warnings;
  },

  /** OE-08: Rush/bump an order — manager overrides queue position. */
  async rushOrder(orderId: string, staffName: string): Promise<Order | null> {
    await delay(200);
    const order = orders.find((o) => o.id === orderId);
    if (!order) return null;
    order.isRushed = true;
    order.rushedBy = staffName;
    order.rushedAt = new Date().toISOString();
    return clone(order);
  },

  /** RV-07: Comp an entire order — writes a comp adjustment for the full order total. */
  async compEntireOrder(orderId: string, reasonCode: string, staffId: string, staffName: string): Promise<TabAdjustment> {
    return this.adjustOrder({
      orderId,
      kind: "comp",
      reasonCode,
      authorStaffId: staffId,
      authorStaffName: staffName,
    });
  },

  /** OT-05: Remake a voided order — creates a remake link from old to new. */
  async remakeOrder(oldOrderId: string, newOrderId: string, reason: string, staffId: string, staffName: string): Promise<OrderRemake> {
    await delay(300);
    const remake: OrderRemake = {
      id: uid("rmk"),
      oldOrderId,
      newOrderId,
      reason,
      remadeByStaffId: staffId,
      remadeByStaffName: staffName,
      remadeAt: new Date().toISOString(),
    };
    remakes = [remake, ...remakes];
    return clone(remake);
  },
};
