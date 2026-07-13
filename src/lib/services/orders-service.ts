import {
  mockOrdersService,
  ORDER_FLOW,
  nextStatus,
} from "@/lib/mock-services/orders-service";
import { liveOrdersService } from "@/lib/live-services/orders-service";
import { isDemoMode } from "@/lib/app-mode";

export type OrdersService = typeof mockOrdersService;

export const ordersService: OrdersService = isDemoMode()
  ? mockOrdersService
  : liveOrdersService;
export { ORDER_FLOW, nextStatus };
