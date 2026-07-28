import {
  mockOrdersService,
} from "@/lib/mock-services/orders-service";
import { nextStatus, ORDER_FLOW } from "@/features/shared/order-status";
import { liveOrdersService } from "@/lib/live-services/orders-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/features/shared/app-mode";

export type OrdersService = typeof mockOrdersService;

export const ordersService: OrdersService = isDemoMode()
  ? demoOnlyService(mockOrdersService)
  : liveOnlyService(liveOrdersService);
export { ORDER_FLOW, nextStatus };
