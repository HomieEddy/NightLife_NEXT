import {
  mockOrdersService,
} from "@/features/ordering/mock-service";
import { nextStatus, ORDER_FLOW } from "@/features/shared/order-status";
import { liveOrdersService } from "@/features/ordering/live-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/features/shared/app-mode";

export type OrdersService = typeof mockOrdersService;

export const ordersService: OrdersService = isDemoMode()
  ? demoOnlyService(mockOrdersService)
  : liveOnlyService(liveOrdersService);
export { ORDER_FLOW, nextStatus };
