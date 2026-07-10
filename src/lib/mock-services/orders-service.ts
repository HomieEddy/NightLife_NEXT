/**
 * mockOrdersService — future backend boundary for order lifecycle.
 * TODO(backend): replace with API routes backed by PostgreSQL + WebSocket pushes.
 */
import type { CartLine, MenuItem, Order, OrderStatus } from "@/lib/types";
import { mockOrders } from "@/lib/mock-data/orders";
import { mockVenue } from "@/lib/mock-data/venue";
import { computeFeeLines, computeServiceFee } from "@/lib/fees";
import { mockMenuService } from "./menu-service";
import { mockVenueService } from "./venue-service";
import { clone, delay, uid } from "./delay";

// Module-level in-memory store: mutations persist across pages within a session,
// simulating shared state between guest and staff surfaces.
let orders: Order[] = clone(mockOrders);
let orderCounter = 39;

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
  }): Promise<Order> {
    await delay(700);
    const subtotal = input.lines.reduce((sum, line) => {
      const modTotal = line.modifiers.reduce((s, m) => s + m.priceDelta, 0);
      return sum + (line.menuItem.price + modTotal) * line.quantity;
    }, 0);
    // Live settings, so fee edits in /manager/settings apply to new orders.
    const venue = mockVenueService.getVenueSnapshot();
    const feeBreakdown = computeFeeLines(subtotal, venue);
    const serviceFee = feeBreakdown.reduce((sum, l) => sum + l.amount, 0);
    const now = new Date().toISOString();
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
      total: Math.round((subtotal + serviceFee + input.tip) * 100) / 100,
      status: "pending",
      placedAt: now,
      updatedAt: now,
    };
    orders = [order, ...orders];
    // Business logic: selling bottles (or packages) draws down tonight's inventory.
    await mockMenuService.recordSale(
      order.items.map((item) => ({ menuItemId: item.menuItemId, quantity: item.quantity })),
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
    menuItem: MenuItem;
    toTableId: string;
    toTableCode: string;
    note?: string;
  }): Promise<Order> {
    await delay(700);
    const subtotal = input.menuItem.price;
    const venue = mockVenueService.getVenueSnapshot();
    const feeBreakdown = computeFeeLines(subtotal, venue);
    const serviceFee = feeBreakdown.reduce((sum, l) => sum + l.amount, 0);
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
      items: [
        {
          id: uid("oi"),
          menuItemId: input.menuItem.id,
          name: input.menuItem.name,
          quantity: 1,
          unitPrice: input.menuItem.price,
          modifiers: [],
        },
      ],
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
    await mockMenuService.recordSale([{ menuItemId: input.menuItem.id, quantity: 1 }]);
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
    return clone(order);
  },

  /** Fails (returns null) if another staff member already claimed it. */
  async claimOrder(orderId: string, staffId: string, staffName: string): Promise<Order | null> {
    await delay(300);
    const order = orders.find((o) => o.id === orderId);
    if (!order || order.claimedByStaffId) return null;
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

  async cancelOrder(orderId: string): Promise<Order | null> {
    await delay(300);
    const order = orders.find((o) => o.id === orderId);
    if (!order) return null;
    order.status = "cancelled";
    order.updatedAt = new Date().toISOString();
    return clone(order);
  },
};
