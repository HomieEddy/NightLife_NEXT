import {
  mockShowQueueService,
  orderNeedsShow,
  showLabelFor,
} from "@/lib/mock-services/show-queue-service";

export type ShowQueueService = typeof mockShowQueueService;

export const showQueueService: ShowQueueService = mockShowQueueService;
export { orderNeedsShow, showLabelFor };
