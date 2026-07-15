import { mockShowQueueService } from "@/lib/mock-services/show-queue-service";
import { orderNeedsShow, showLabelFor } from "@/lib/order-presentation";
import { liveShowQueueService } from "@/lib/live-services/show-queue-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/lib/app-mode";

export type ShowQueueService = typeof mockShowQueueService;

export const showQueueService: ShowQueueService = isDemoMode()
  ? demoOnlyService(mockShowQueueService)
  : liveOnlyService(liveShowQueueService);
export { orderNeedsShow, showLabelFor };
