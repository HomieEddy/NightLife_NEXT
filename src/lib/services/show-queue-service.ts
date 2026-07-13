import {
  mockShowQueueService,
  orderNeedsShow,
  showLabelFor,
} from "@/lib/mock-services/show-queue-service";
import { liveShowQueueService } from "@/lib/live-services/show-queue-service";
import { isDemoMode } from "@/lib/app-mode";

export type ShowQueueService = typeof mockShowQueueService;

export const showQueueService: ShowQueueService = isDemoMode()
  ? mockShowQueueService
  : liveShowQueueService;
export { orderNeedsShow, showLabelFor };
