import { mockShowQueueService } from "@/features/realtime/show-queue-mock-service";
import { orderNeedsShow, showLabelFor } from "@/lib/order-presentation";
import { liveShowQueueService } from "@/features/realtime/show-queue-live-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/features/shared/app-mode";

export type ShowQueueService = typeof mockShowQueueService;

export const showQueueService: ShowQueueService = isDemoMode()
  ? demoOnlyService(mockShowQueueService)
  : liveOnlyService(liveShowQueueService);
export { orderNeedsShow, showLabelFor };
