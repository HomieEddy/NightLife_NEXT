import { mockPromotionsService } from "@/features/hospitality/promotions-mock-service";
import { livePromotionsService } from "@/features/hospitality/promotions-live-service";
import { demoOnlyService, isDemoMode, liveOnlyService } from "@/features/shared/app-mode";

export type PromotionsService = typeof mockPromotionsService;

export const promotionsService: PromotionsService = isDemoMode()
  ? demoOnlyService(mockPromotionsService)
  : liveOnlyService(livePromotionsService);
