/**
 * mockOrdersService — future backend boundary for order lifecycle.
 * The permanent demo counterpart to transactional live orders and SSE updates.
 */
import type { CartLine, MenuItem, Order, OrderStatus } from "@/lib/types";
import { mockOrders } from "@/lib/mock-data/orders";
import { mockVenue } from "@/lib/mock-data/venue";
import { computeFeeLines, computeServiceFee } from "@/lib/fees";
import { cartHappyHourDiscount } from "@/lib/happy-hour";
import { orderLineSubtotal } from "@/lib/order-line";
import { nextStatus, ORDER_FLOW } from "@/lib/order-status";
import { mockGuestsService } from "./guests-service";
import { mockMenuService, restoreSale } from "./menu-service";
import { mockVenueService } from "./venue-service";
import { clone, delay, uid } from "./delay";

export { nextStatus, ORDER_FLOW };

// Module-level in-memory store: mutations persist across pages within a session,
// simulating shared state between guest and staff surfaces.
let orders: Order[] = clone(mockOrders);
let orderCounter = 39;

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
};
