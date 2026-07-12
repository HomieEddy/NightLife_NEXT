import {
  mockOrdersService,
  ORDER_FLOW,
  nextStatus,
} from "@/lib/mock-services/orders-service";

export type OrdersService = typeof mockOrdersService;

export const ordersService: OrdersService = mockOrdersService;
export { ORDER_FLOW, nextStatus };
