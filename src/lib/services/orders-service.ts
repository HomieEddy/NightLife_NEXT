import {
  mockOrdersService,
  ORDER_FLOW,
  nextStatus,
} from "@/lib/mock-services/orders-service";
import { liveOrdersService } from "@/lib/live-services/orders-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/lib/app-mode";

export type OrdersService = typeof mockOrdersService;

export const ordersService: OrdersService = isDemoMode()
  ? demoOnlyService(mockOrdersService)
  : liveOnlyService(liveOrdersService);
export { ORDER_FLOW, nextStatus };
